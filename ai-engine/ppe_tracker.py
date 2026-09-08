# SPDX-License-Identifier: MIT

import cv2
import numpy as np
import torch
from ultralytics import YOLO
from collections import defaultdict
from zones import filter_persons_in_zones
import time
import os
import json
from datetime import datetime

# BoT-SORT mặc định vứt mọi khung conf < 0.25 TRƯỚC khi tới logic PPE ở dưới ->
# giày/găng (khung nhỏ, conf thấp) không bao giờ tới nơi. File này hạ ngưỡng đó.
TRACKER_CFG = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'botsort_ppe.yaml')


class InstanceDetector:
    """Detect PPE compliance per instance with configurable settings - From tailieu/Construction-Site-Safety-PPE-Detection"""
    
    def __init__(self, window_seconds=5):
        self.window_seconds = window_seconds
        self.last_non_compliant_time = 0
        self.last_activity_time = 0
        self.current_instance_id = None
        self.instance_serial = 0 # Simplified for demo
        self.in_non_compliant_period = False
        
        self.non_compliance_delay = 3  # seconds before declaring non-compliant
        self.non_compliance_start_time = None 
        self.pending_non_compliant = False 
        
        self.required_ppe_settings = {
            'helmet': True,
            'vest': True,
            'mask': False
        }
    
    def process_detections(self, all_detections):
        """Process all detections and determine compliance status"""
        current_time = time.time()
        
        has_person = any(d['class'].lower() == 'person' for d in all_detections)
        if not has_person:
            self.pending_non_compliant = False
            self.non_compliance_start_time = None
            return {
                'instance_id': None,
                'is_compliant': True,
                'missing_ppe': []
            }
        
        self.last_activity_time = current_time
        detected_classes = [d['class'].lower() for d in all_detections]
        
        missing_ppe = []
        
        # Logic from tailieu: check for NO-X classes
        if self.required_ppe_settings.get('helmet') and 'no-hardhat' in detected_classes:
            missing_ppe.append('Mũ bảo hộ')
        if self.required_ppe_settings.get('vest') and 'no-safety vest' in detected_classes:
            missing_ppe.append('Áo phản quang')
        if self.required_ppe_settings.get('mask') and 'no-mask' in detected_classes:
            missing_ppe.append('Khẩu trang')

        # Fallback: if required but not found in positive classes either (simpler logic)
        if self.required_ppe_settings.get('helmet') and 'hardhat' not in detected_classes and 'no-hardhat' not in detected_classes:
             missing_ppe.append('Mũ bảo hộ')

        raw_is_compliant = len(missing_ppe) == 0
        
        # Handle delay logic
        if not raw_is_compliant:
            if not self.pending_non_compliant:
                self.pending_non_compliant = True
                self.non_compliance_start_time = current_time
            
            time_since_detection = current_time - self.non_compliance_start_time
            is_compliant = time_since_detection < self.non_compliance_delay
        else:
            self.pending_non_compliant = False
            self.non_compliance_start_time = None
            is_compliant = True
            
        return {
            'instance_id': "W-" + str(int(current_time) % 10000),
            'missing_ppe': missing_ppe
        }

class PPEViolationTracker:
    # Tên hiển thị tiếng Việt cho từng loại PPE
    PPE_VN = {
        'helmet': 'MŨ', 'vest': 'ÁO', 'gloves': 'GĂNG',
        'boots': 'GIÀY', 'goggles': 'KÍNH',
    }

    # Mũ phải đạt độ tin cậy này mới coi là MŨ BẢO HỘ (mũ lao động) thật.
    # Đủ để chặn nhiễu nhưng KHÔNG quá gắt (0.45 làm sót mũ thật -> báo THIẾU MŨ oan).
    HELMET_MIN_CONF = 0.35

    # GĂNG/GIÀY: box nhỏ, hay bị che, model kém tin cậy hơn mũ/áo -> lọc riêng
    # trước khi tính present/missing, cùng ý tưởng HELMET_MIN_CONF, tránh 1 khung
    # nhiễu thoáng qua (vừa đủ self.confidence=0.25) làm chốt sai còn/thiếu.
    # Ngưỡng RIÊNG cho từng lớp: đo trên samples1.mp4 (60 frame), giày CAO NHẤT chỉ
    # 0.30 -> mức 0.35 dùng chung lọc sạch 100% khung giày dù box vẽ đúng bàn chân.
    # Giày yếu vì dataset train chỉ có ~1.2k nhãn boots. Train lại xong thì nâng lại.
    # Chọn bằng phép quét ngưỡng (scratchpad/sweep.py), không chọn cảm tính.
    # Giày 0.20 -> 0.15: báo oan 9.1% -> 6.5% mà bỏ lọt giữ nguyên 1.6%.
    PART_MIN_CONF = {'gloves': 0.25, 'boots': 0.15}
    # Lớp KHÔNG nằm trong dict trên (vest, no_goggle, no_gloves...) giữ sàn 0.25 —
    # đúng bằng ngưỡng conf thô cũ, để việc hạ conf thô xuống 0.15 (cho giày lọt)
    # không kéo theo một đống khung đỏ 'THIẾU GOGGLE/GĂNG' rác (mAP 0.003-0.04).
    OTHER_MIN_CONF = 0.25

    # Ngưỡng RIÊNG để CHỐT vi phạm (ghi DB) — cao hơn ngưỡng detect thô (self.confidence)
    # vì detect thô ưu tiên bắt sớm cho khung UI mượt, còn ghi DB cần chắc chắn hơn.
    CONFIRM_CONF = 0.6
    # Trạng thái "thiếu PPE" phải tồn tại LIÊN TỤC bằng này giây mới chốt là vi phạm
    # (người cúi xuống/mũ lệch 1 khoảnh khắc -> không tính, tránh báo oan).
    CONFIRM_DELAY = 3.0
    # Thấy món PPE trên người này trong bao nhiêu giây gần nhất thì vẫn tính là CÓ.
    # Dài hơn -> ít báo oan hơn nhưng phát hiện tháo đồ chậm hơn đúng bằng ngần đó.
    # 12 giây (trước là 2). Nguyên tắc anh đặt: THẤY RỒI THÌ GIỮ XANH, chỉ khi
    # cả một khoảng dài không thấy nữa (họ cởi ra) mới báo thiếu.
    # Model chỉ nhận ra găng ở ~23% số khung trên video thật, nên cửa sổ 2s có
    # nhiều đoạn trống > 2s -> lật sang đỏ oan trong khi găng vẫn đang đeo.
    # Đánh đổi: ai tháo đồ ra thì chậm bị phát hiện đúng 12 giây.
    # Thời gian QUAN SÁT trước khi được phép buộc tội. Người vừa vào khung hình,
    # model chưa kịp nhìn thấy găng/giày -> KHÔNG kết luận thiếu ngay. Đo trên
    # video thật: găng chỉ được nhận ra từ khung 47/90, nên 46 khung đầu bị báo
    # thiếu oan dù người ta đang đeo. Chưa đủ thời gian quan sát thì không vẽ gì.
    THOI_GIAN_QUAN_SAT = 3.0
    # 2.5s (trước 12s). Anh cần ĐEO VÀO / THÁO RA lúc nào cũng bắt kịp — nhớ 12
    # giây thì tháo găng ra vẫn xanh suốt 12 giây. Hạ được xuống vì model găng
    # giờ nhận chắc ở cả cự ly webcam (81% khi có găng, 86% khi tay trần) nên
    # không cần bù bằng trí nhớ dài nữa.
    EVIDENCE_WINDOW = 2.5
    # GIỮ KHUNG găng/giày bao lâu sau lần cuối nhìn thấy. Model chỉ bắt được
    # ~65% số khung nên cứ 3 khung lại mất 1 -> khung nhấp nháy. Chẩn đoán 8/8
    # ca lỗi cho thấy model CÓ thấy nhưng conf 0.12-0.22 (dưới ngưỡng), tức chỉ
    # mờ đi chứ không mất. Giữ lại vị trí cũ, NEO THEO KHUNG NGƯỜI để nó chạy
    # cùng người thay vì đứng im khi người bước đi.
    # 2.0s: chọn bằng đo, không cảm tính. Trên samples1.mp4 (150 khung):
    #   1.0s -> găng 77% / giày 80% ; 1.5s -> 80/87 ; 2.0s -> 83/93 ; 3.0s -> 83/98
    # Găng bão hoà ở 2.0s. Chọn 3.0s chỉ thêm 5 điểm giày mà đổi lấy thêm 1 giây
    # mù khi người ta THÁO đồ ra. Đặt bằng EVIDENCE_WINDOW cho nhất quán.
    HOLD_SECONDS = 2.5
    # Ba model PPE ăn 93% thời gian (216+203+195 ms) còn model tư thế chỉ 45 ms.
    # Mà tư thế mới quyết định VỊ TRÍ khung, còn PPE quyết định CÓ/THIẾU — thứ
    # thay đổi rất chậm (không ai tháo găng trong 1/10 giây).
    # -> chạy PPE mỗi N khung, tư thế mọi khung. Khung vẫn bám tay mượt.
    # N=3 chọn bằng đo (40 khung, video của anh):
    #   N=1  2.0 fps  găng 97%      N=3  3.7 fps  găng 95%
    #   N=2  2.7 fps  găng 97%      N=4  4.0 fps  găng 92%
    # N=3: nhanh gần gấp đôi, mất 2 điểm. Cần chính xác tuyệt đối thì để N=2
    # (nhanh hơn 35% mà không mất gì).
    PPE_MOI_N_KHUNG = 3
    # Độ tin cậy TỐI THIỂU để coi là NGƯỜI thật. Ngưỡng thô để 0.15 cho bắt được
    # găng/giày mờ, nhưng người thì không được dễ dãi vậy: đo trên webcam phòng
    # TRỐNG, model vẫn "thấy người" ở 22/45 khung với conf thấp tới 0.20 (bóng đổ,
    # đồ vật) rồi từ người giả đó vẽ ra THIẾU MŨ / THIẾU ÁO.
    NGUONG_NGUOI = 0.45

    def __init__(self,
                 model_path: str = 'ppe_v8s_custom.pt',
                 confidence: float = 0.5,
                 min_height_ratio: float = 0.10,
                 required_ppe = ('helmet', 'vest'),
                 imgsz: int = 480,
                 parts_models: dict = None):
        """Initialize tracking system with newly trained model.

        min_height_ratio: chỉ xét đối tượng CHÍNH ở gần (box cao >= tỉ lệ này so
        với khung hình). Đối tượng chuyển động ở xa (người/xe nền) có box nhỏ sẽ
        bị bỏ qua. Tăng giá trị -> bỏ qua nhiều hơn; giảm -> bắt cả vật xa hơn.

        required_ppe: danh sách PPE BẮT BUỘC. Người thiếu bất kỳ món nào -> VI PHẠM
        (khung đỏ). Mặc định ở ĐÂY vẫn là mũ + áo, nhưng luồng camera thật
        (yolo_inference.py) truyền vào cả 'gloves','boots' theo yêu cầu 24/08/2026:
        người không đeo găng / không đi giày cũng phải bị tính vi phạm.
        Số đo đi kèm (ai-engine/eval_ppe_decision.py, 283 ảnh có nhãn):
        báo oan găng 11.3%, giày 9.1%, mũ 4.7%, áo 3.1%.
        """

        # Use GPU if available
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        if not torch.cuda.is_available() and torch.backends.mps.is_available():
            device = 'mps'

        print(f"Loading Integrated PPE Model: {model_path} on {device}")
        self.model = YOLO(model_path).to(device)
        self.confidence = confidence
        self.min_height_ratio = min_height_ratio
        self.required_ppe = [p.lower() for p in required_ppe]
        self.imgsz = imgsz  # kích thước xử lý nhỏ hơn -> model chạy nhanh -> khung cập nhật dày hơn
        self.last_person_count = 0  # số người của khung gần nhất (sau khi lọc vùng làm việc)

        # Đọc TÊN LỚP trực tiếp từ model → tự khớp mọi model (4 lớp cũ hoặc 11 lớp mới:
        # Person, helmet, vest, gloves, boots, goggles + biến thể no_*)
        self.class_names = self.model.names  # dict {id: 'name'}

        # MODEL PHỤ cho găng/giày. Lý do tách đôi: các bản train lại đều giỏi
        # găng/giày hơn NHƯNG làm hỏng lớp áo (báo oan 3.1% -> 7.1..9.5%), mà áo
        # đang dùng để phạt thật. Lấy găng/giày từ model phụ, còn người/mũ/áo giữ
        # nguyên từ model chính -> mũ/áo KHÔNG THỂ bị ảnh hưởng.
        # Giá: chạy 2 lần suy luận mỗi khung (~2x chậm). Chấp nhận được cho 1 luồng
        # webcam demo; nếu sau này chạy nhiều camera thì bỏ model phụ đi.
        # MODEL TƯ THẾ: cho toạ độ THẬT của cổ tay/cổ chân (17 điểm khớp COCO).
        # Trước đây khung "THIẾU GĂNG/GIÀY" vẽ theo ô suy từ khung người -> ô nằm
        # chết một chỗ, anh giơ tay lên thì ô vẫn ở ngang hông, và khi tay/chân
        # KHÔNG có trong khung hình thì vẫn vẽ ô vào chỗ trống. Dùng điểm khớp thì
        # khung bám đúng tay/chân, và không thấy thì KHÔNG VẼ.
        # Không có sẵn file thì ultralytics tự tải (~6.5MB) -> CẦN MẠNG lần đầu.
        # Không có mạng thì chạy tiếp không có model tư thế, chỉ mất khung chỉ chỗ
        # tay/chân — KHÔNG được để cả hệ thống camera chết vì một file phụ.
        try:
            self.pose_model = YOLO('yolov8n-pose.pt').to(device)
        except Exception as e:
            print(f"⚠️  Không nạp được yolov8n-pose.pt ({e}) — bỏ khung chỉ chỗ "
                  f"tay/chân, phần còn lại vẫn chạy bình thường.")
            self.pose_model = None
        # MODEL PHỤ theo TỪNG LỚP: {'gloves': 'ppe_gang.pt', 'boots': 'ppe_boots.pt'}.
        # Mỗi lớp yếu được một model chuyên lo, các lớp còn lại (người/mũ/áo) vẫn do
        # model chính sinh ra -> không thể bị ảnh hưởng.
        # File .pt bị .gitignore chặn nên KHÔNG đi kèm repo. Thiếu file nào thì lớp
        # đó quay về model chính (kém hơn nhưng vẫn chạy), không làm chết cả hệ thống.
        self.parts_models = {}
        for lop, duong_dan in (parts_models or {}).items():
            try:
                self.parts_models[lop.lower()] = YOLO(duong_dan).to(device)
                print(f"  + model phụ cho '{lop}': {duong_dan}")
            except Exception as e:
                print(f"⚠️  Không nạp được model phụ {duong_dan} cho '{lop}' ({e}) "
                      f"— dùng model chính cho lớp này.")
        self.parts_classes = set(self.parts_models)

        # trackId -> thời điểm ĐẦU TIÊN thấy người này vi phạm liên tục (để tính CONFIRM_DELAY).
        # ponytail: dict không tự dọn track đã rời khung hình lâu -> phình dần theo phiên chạy dài;
        # nếu chạy 24/7 thì thêm bước dọn định kỳ (vd theo max_age của tracker).
        self._violation_since = {}
        # trackId -> {tên PPE: lần cuối NHÌN THẤY món đó trên người này}
        # ponytail: cùng vấn đề dọn rác như _violation_since ở trên, dọn chung một thể.
        self._ppe_last_seen = {}
        # trackId -> {tên món: (hộp theo TỈ LỆ trong khung người, thời điểm, conf)}
        self._part_memory = {}
        # trackId -> lần ĐẦU TIÊN thấy người này (để tính thời gian quan sát)
        self._lan_dau_thay = {}
        self._dem_khung = 0          # đếm khung để biết khi nào chạy lại model PPE
        self._items_cu = []          # kết quả PPE của lần chạy gần nhất

    @staticmethod
    def _noi_rong(box, ti_le):
        """Nới khung ra mỗi chiều `ti_le` lần kích thước, để ôm cả tay/chân thò ra."""
        w, h = box[2] - box[0], box[3] - box[1]
        return [box[0] - w * ti_le, box[1] - h * ti_le,
                box[2] + w * ti_le, box[3] + h * ti_le]

    @staticmethod
    def _to_rel(box, p):
        """Hộp tuyệt đối -> tỉ lệ trong khung người, để neo được khi người di chuyển."""
        pw, ph = max(p[2] - p[0], 1e-6), max(p[3] - p[1], 1e-6)
        return [(box[0] - p[0]) / pw, (box[1] - p[1]) / ph,
                (box[2] - p[0]) / pw, (box[3] - p[1]) / ph]

    @staticmethod
    def _to_abs(rel, p):
        pw, ph = p[2] - p[0], p[3] - p[1]
        return [p[0] + rel[0] * pw, p[1] + rel[1] * ph,
                p[0] + rel[2] * pw, p[1] + rel[3] * ph]

    @staticmethod
    def _center_inside(inner, outer):
        """Tâm của box 'inner' có nằm trong box 'outer' không (để gán PPE cho người)."""
        cx = (inner[0] + inner[2]) / 2
        cy = (inner[1] + inner[3]) / 2
        return outer[0] <= cx <= outer[2] and outer[1] <= cy <= outer[3]

    def _bbox_pct(self, box, frame):
        return {
            "top": f"{(box[1]/frame.shape[0])*100}%",
            "left": f"{(box[0]/frame.shape[1])*100}%",
            "width": f"{((box[2]-box[0])/frame.shape[1])*100}%",
            "height": f"{((box[3]-box[1])/frame.shape[0])*100}%",
        }

    def process_frame(self, frame: np.ndarray, zones: list | None = None) -> list:
        """Process frame -> detections cho dashboard.

        2 tầng khung:
          1) Khung TỪNG BỘ PHẬN model thấy (mũ/áo/găng/giày...) — xanh, hoặc đỏ nếu là no_*.
          2) Khung TỪNG NGƯỜI — xét đủ/thiếu PPE bắt buộc: thiếu -> ĐỎ + VI PHẠM.

        zones: danh sách đa giác (toạ độ tỉ lệ 0–1 theo khung) = vùng làm việc của
        camera. None/rỗng -> xét cả khung như trước.
        """
        final_detections = []

        # augment=True (TTA): model chạy thêm ở nhiều tỉ lệ/lật ảnh rồi gộp kết quả.
        # Đo 150 frame samples1.mp4: frame BẮT ĐƯỢC GIÀY 44.7% -> 74.0% (găng đứng yên
        # ~75%). Giá phải trả: 14.5 -> 7.2 fps. Đổi tốc độ lấy chân, bỏ chữ này là về cũ.
        # iou=0.5 (mặc định 0.7): TTA đẻ box trùng (4 box cho 2 bàn chân) -> siết NMS
        # bớt 19% box thừa mà KHÔNG mất frame nào.
        self._dem_khung += 1
        results = self.model.track(frame, persist=True, conf=self.confidence,
                                   imgsz=self.imgsz, tracker=TRACKER_CFG,
                                   augment=True, iou=0.5, verbose=False)[0]
        if results.boxes is None:
            return final_detections

        boxes = results.boxes.xyxy.cpu().tolist()
        ids = results.boxes.id.int().cpu().tolist() if results.boxes.id is not None else [None] * len(boxes)
        classes = results.boxes.cls.int().cpu().tolist()
        confs = results.boxes.conf.cpu().tolist()

        # Điểm khớp cho cả khung hình, khớp với người sau bằng IoU
        _pose_boxes, _pose_kp, _pose_kc = [], [], []
        if self.pose_model is not None:
            _pose = self.pose_model.predict(frame, conf=0.3, verbose=False)[0]
            _pose_boxes = _pose.boxes.xyxy.cpu().tolist() if _pose.boxes is not None else []
            _pose_kp = _pose.keypoints.xy.cpu().tolist() if _pose.keypoints is not None else []
            _pose_kc = (_pose.keypoints.conf.cpu().tolist()
                        if (_pose.keypoints is not None and _pose.keypoints.conf is not None) else [])

        persons = []   # {'box','id','conf'}
        items = []     # {'name','box','conf'}  (mọi PPE trừ person)

        for box, track_id, cls_id, conf in zip(boxes, ids, classes, confs):
            if cls_id >= len(self.class_names):
                continue
            cls_name = self.class_names[cls_id]
            low = cls_name.lower()
            if low in ('none', 'null'):
                continue
            if (box[3] - box[1]) / frame.shape[0] < self.min_height_ratio:
                continue

            if low == 'person':
                if conf < self.NGUONG_NGUOI:
                    continue          # không đủ tin là người -> bỏ, khỏi vẽ gì
                persons.append({'box': box, 'id': track_id, 'conf': conf})
            else:
                items.append({'name': low, 'box': box, 'conf': conf})

            status = "VIOLATION" if low.startswith('no_') else "SAFE"
            print(f"[DETECT] {cls_name:10} | Conf: {conf:.2f} | Status: {status}")

        # VÙNG LÀM VIỆC: người có ĐIỂM CHÂN ngoài mọi vùng MONITORING -> loại ngay
        # tại đây, trước khi xét PPE, nên họ không sinh vi phạm và cũng không được
        # tính là người quan sát. Logic nhận diện phía dưới giữ nguyên.
        if zones:
            _truoc = len(persons)
            persons = filter_persons_in_zones(persons, zones, frame.shape[1], frame.shape[0])
            if len(persons) < _truoc:
                print(f"[ZONE] bỏ qua {_truoc - len(persons)} người ngoài vùng làm việc")

        # Số người ĐANG XÉT của khung vừa rồi (đã lọc vùng). yolo_inference.py cộng dồn
        # thành "người × giây" mỗi phút -> mẫu số của tỉ lệ tuân thủ. Để ở thuộc tính
        # thay vì đổi kiểu trả về, giữ nguyên chữ ký process_frame cho mọi nơi gọi.
        self.last_person_count = len(persons)

        # Thay khung GĂNG/GIÀY bằng kết quả model phụ (nếu có). Chỉ đụng đúng
        # những lớp trong parts_classes — người/mũ/áo giữ nguyên của model chính.
        if self.parts_models:
            def _base(n):
                return n[3:] if n.startswith('no_') else n
            items = [it for it in items if _base(it['name']) not in self.parts_classes]
            # Giữa hai chu kỳ: dùng lại kết quả PPE gần nhất thay vì chạy lại 2 model
            # nặng (~400ms). Vị trí khung vẫn tươi vì lấy từ model tư thế bên dưới.
            if self._dem_khung % self.PPE_MOI_N_KHUNG != 0 and self._items_cu:
                items = items + list(self._items_cu)
                self.parts_models_bo_qua = True
            else:
                self.parts_models_bo_qua = False
                _moi = []
                for lop, mp in self.parts_models.items():
                    pr = mp.predict(frame, conf=self.confidence, imgsz=self.imgsz,
                                    augment=True, iou=0.5, verbose=False)[0]
                    for box, cid, cf in zip(pr.boxes.xyxy.cpu().tolist(),
                                            pr.boxes.cls.int().cpu().tolist(),
                                            pr.boxes.conf.cpu().tolist()):
                        nm = mp.names[cid].lower()
                        # mỗi model phụ CHỈ đóng góp đúng lớp nó phụ trách
                        if _base(nm) != lop:
                            continue
                        if (box[3] - box[1]) / frame.shape[0] < self.min_height_ratio:
                            continue
                        _moi.append({'name': nm, 'box': box, 'conf': cf})
                items = items + _moi
                self._items_cu = _moi

        # --- GIỮ KHUNG găng/giày qua các khung hình model trượt ---
        # Với mỗi người đang được bám vết: món nào THẤY ở khung này thì ghi nhớ vị
        # trí (theo tỉ lệ trong khung người); món nào KHÔNG thấy mà mới thấy trong
        # HOLD_SECONDS giây thì dựng lại hộp đó theo khung người HIỆN TẠI -> khung
        # bám theo người thay vì nhấp nháy hoặc đứng ì tại chỗ cũ.
        _now = time.time()
        _giu = {'gloves', 'boots'}
        for _p in persons:
            _tid = _p['id']
            if _tid is None:
                continue
            _mem = self._part_memory.setdefault(_tid, {})
            _thay = set()
            for _it in items:
                _b = _it['name'][3:] if _it['name'].startswith('no_') else _it['name']
                if _b in _giu and self._center_inside(_it['box'], _p['box']):
                    _mem[_it['name']] = (self._to_rel(_it['box'], _p['box']), _now, _it['conf'])
                    _thay.add(_it['name'])
            for _nm, (_rel, _ts, _cf) in list(_mem.items()):
                if _nm in _thay:
                    continue
                if _now - _ts > self.HOLD_SECONDS:
                    del _mem[_nm]
                    continue
                items.append({'name': _nm, 'box': self._to_abs(_rel, _p['box']),
                              'conf': _cf, 'giu': True})

        # --- GỌN KHUNG THIẾU: mỗi người, mỗi món chỉ MỘT khung ---
        # Lớp no_* tin cậy thấp nên hay đẻ nhiều hộp chồng nhau trên cùng bàn tay
        # (đã thấy trên màn hình: "THIẾU GĂNG 55%" và "THIẾU GĂNG 40%" cùng lúc,
        # kèm mấy hộp mảnh xếp lớp). Giữ hộp tin cậy nhất cho mỗi (người, món),
        # và bỏ hộp không dính vào người nào — nhãn của từng người ở Tầng 2 đã
        # liệt kê đủ rồi, khung nhỏ chỉ để CHỈ CHỖ, một cái là đủ.
        _viol = [it for it in items if it['name'].startswith('no_')]
        if _viol:
            _tot = {}
            for _it in _viol:
                _b = _it['name'][3:]
                for _i, _p in enumerate(persons):
                    if self._center_inside(_it['box'], _p['box']):
                        _k = (_i, _b)
                        if _k not in _tot or _it['conf'] > _tot[_k]['conf']:
                            _tot[_k] = _it
                        break
            _giu_lai = list(_tot.values())
            items = [it for it in items if not it['name'].startswith('no_')] + _giu_lai

        # KHÔNG vẽ khung thô của model nữa. Trước đây mỗi vật model thấy là một
        # khung, cộng thêm khung suy ra ở Tầng 2 -> màn hình chi chít khung chồng
        # nhau, cùng một bàn chân vừa xanh vừa đỏ. Giờ MỖI NGƯỜI, MỖI MÓN đúng
        # MỘT khung: xanh = có, đỏ = thiếu. Không còn trạng thái thứ ba.

        # --- Tầng 2: khung từng người + xét đủ/thiếu PPE ---
        for p in persons:
            px1, py1, px2, py2 = p['box']
            pw, ph = px2 - px1, py2 - py1
            # Vùng ĐẦU = phần trên của khung người (tự dịch theo người khi di chuyển).
            # MŨ chỉ HỢP LỆ khi TÂM mũ nằm trong vùng đầu này. Mũ cầm tay / treo / để
            # dưới đất -> KHÔNG tính là đội -> người này bị coi là THIẾU MŨ (vi phạm).
            # Nới rộng 2 bên + cao hơn đỉnh đầu 1 chút để ôm trọn mũ (mũ hay cao/lệch
            # hơn khung người -> nếu bó hẹp sẽ trượt mất mũ thật -> báo thiếu mũ oan).
            # Ghép người này với bộ điểm khớp tương ứng (làm TRƯỚC khi xét mũ).
            _kp = None
            _best = 0.4
            for _pb, _k_, _kc_ in zip(_pose_boxes, _pose_kp,
                                      _pose_kc or [[1.0] * 17] * len(_pose_kp)):
                _x1, _y1 = max(_pb[0], px1), max(_pb[1], py1)
                _x2, _y2 = min(_pb[2], px2), min(_pb[3], py2)
                if _x2 <= _x1 or _y2 <= _y1:
                    continue
                _inter = (_x2 - _x1) * (_y2 - _y1)
                _u = (_pb[2] - _pb[0]) * (_pb[3] - _pb[1]) + pw * ph - _inter
                if _u > 0 and _inter / _u > _best:
                    _best, _kp = _inter / _u, (_k_, _kc_)
            _k, _kc = _kp if _kp else (None, None)

            # VÙNG ĐẦU lấy từ ĐIỂM KHỚP (mũi/mắt/tai), không suy từ khung người.
            # Cách cũ lấy "35% phía trên khung người" -> người CÚI XUỐNG (đào đất,
            # khiêng vật) có đầu tụt xuống giữa khung, mũ thật rơi ra ngoài vùng đó
            # -> model thấy mũ nhưng logic bảo "không đội" -> báo THIẾU MŨ oan.
            _dau_kp = None
            if _k is not None:
                _pts = [_k[i] for i in (0, 1, 2, 3, 4)
                        if i < len(_k) and not (_kc is not None and i < len(_kc)
                                                and _kc[i] < 0.5)]
                if _pts:
                    _xs = [q[0] for q in _pts]; _ys = [q[1] for q in _pts]
                    _w = max(max(_xs) - min(_xs), pw * 0.12)
                    _h = max(max(_ys) - min(_ys), ph * 0.06)
                    _dau_kp = [min(_xs) - _w * 0.6, min(_ys) - _h * 1.2,
                               max(_xs) + _w * 0.6, max(_ys) + _h * 0.6]
            head_region = _dau_kp or [px1 + pw * 0.05, py1 - ph * 0.08,
                                      px2 - pw * 0.05, py1 + ph * 0.35]

            present, explicit_missing = set(), set()
            helmet_on_head = False
            head_helmet_box = None
            for it in items:
                name = it['name']
                is_no = name.startswith('no_')
                base = name[3:] if is_no else name

                if base == 'helmet':
                    # Mũ BẢO HỘ: chỉ xét khi ở TRÊN ĐẦU (tâm trong vùng đầu) VÀ đủ
                    # tin cậy (loại mũ thường / vật giống mũ). Ngoài vùng đầu -> bỏ qua.
                    if (self._center_inside(it['box'], head_region)
                            and it['conf'] >= self.HELMET_MIN_CONF):
                        if is_no:
                            explicit_missing.add('helmet')
                        else:
                            helmet_on_head = True
                            head_helmet_box = it['box']
                            present.add('helmet')
                    continue

                # GĂNG/GIÀY: bỏ qua khung tin cậy thấp (nhiễu), tránh chốt sai còn/thiếu.
                if it['conf'] < self.PART_MIN_CONF.get(base, self.OTHER_MIN_CONF):
                    continue

                # PPE khác (áo/găng/giày...): xét theo toàn thân (tâm trong khung người)
                # Nới rộng khung người khi gán bộ phận: bàn tay giơ ra, bàn chân
                # bước tới thường NẰM NGOÀI khung người model vẽ. Dùng khung chặt
                # thì món đồ bị coi là "của người khác" -> người này bị tính THIẾU,
                # trong khi Tầng 1 vẫn vẽ khung xanh cho chính món đó -> màn hình
                # vừa xanh vừa đỏ trên cùng bàn chân. Đó là mâu thuẫn anh nhìn thấy.
                if self._center_inside(it['box'], self._noi_rong(p['box'], 0.12)):
                    if is_no:
                        explicit_missing.add(base)
                    else:
                        present.add(base)

            # BẰNG CHỨNG THEO THỜI GIAN — chống báo oan.
            # Trước: mất DẤU món đồ đúng 1 khung là kết luận thiếu ngay. Đo trên 283
            # ảnh có nhãn: 11.3% người ĐANG đeo găng bị bảo thiếu, giày 9.1%.
            # Giờ: đã nhìn thấy món đồ trên người này trong EVIDENCE_WINDOW giây gần
            # nhất thì vẫn tính là CÓ. Người đeo găng chỉ bị kết luận thiếu khi suốt
            # cả cửa sổ đó không khung nào thấy găng.
            # Đánh đổi: ai tháo đồ ra thì chậm bị phát hiện đúng bằng EVIDENCE_WINDOW.
            tid = p['id']
            now = time.time()
            if tid is not None:
                seen = self._ppe_last_seen.setdefault(tid, {})
                for base in present:
                    seen[base] = now
                present = present | {k for k, ts in seen.items()
                                     if now - ts <= self.EVIDENCE_WINDOW}

            # ĐÃ NHÌN THẤY MÓN ĐỒ THÌ THẮNG. Model có thể vừa nhận ra `boots` vừa
            # nhận ra `no_boots` trên CÙNG bàn chân (model chuyên giày càng hay gặp
            # vì nó nhận `no_boots` tốt hơn hẳn). Trước đây explicit_missing thắng
            # -> màn hình vẽ khung xanh GIÀY rồi lại đè khung đỏ THIẾU GIÀY lên
            # đúng bàn chân đó. Nhìn thấy đồ bảo hộ là bằng chứng chắc hơn hẳn
            # "nhìn thấy chỗ trống", nên cho present thắng.
            # Chưa quan sát đủ lâu -> CHƯA kết luận thiếu món nào (trừ món đã thấy rõ
            # là thiếu qua lớp phủ định). Tránh buộc tội người vừa mới vào khung.
            _lan_dau = self._lan_dau_thay.setdefault(tid, time.time()) if tid is not None else 0
            _du_quan_sat = tid is None or (time.time() - _lan_dau) >= self.THOI_GIAN_QUAN_SAT

            missing = [req for req in self.required_ppe
                       if req not in present and req in (explicit_missing | set(self.required_ppe))]
            chua_ket_luan = set()
            if not _du_quan_sat:
                # CHỈ hoãn kết luận với găng/giày — hai món model hay bỏ sót lúc đầu.
                # Mũ/áo model nhận ra ngay và đang đúng 100%, hoãn chúng lại làm
                # THIẾU MŨ tụt từ 100% xuống 60% (đo trên chính video của anh).
                hoan = [m for m in missing
                        if m not in explicit_missing and m in ('gloves', 'boots')]
                chua_ket_luan = set(hoan)
                missing = [m for m in missing if m not in chua_ket_luan]
            is_violation = len(missing) > 0

            # Chốt vi phạm để GHI DB: cần conf cao hơn (CONFIRM_CONF) VÀ trạng thái
            # thiếu PPE tồn tại liên tục >= CONFIRM_DELAY giây. isViolation (dưới) vẫn
            # bật ngay để khung UI phản hồi tức thời — chỉ "confirmed" mới bị delay.
            confirmed = False
            if is_violation and p['conf'] >= self.CONFIRM_CONF:
                since = self._violation_since.setdefault(tid, time.time())
                confirmed = (time.time() - since) >= self.CONFIRM_DELAY
            else:
                self._violation_since.pop(tid, None)

            # Khung tổng KHÔNG có chữ — anh yêu cầu. Thiếu món nào đã thấy ngay ở
            # khung đỏ của đúng món đó trên người, không cần liệt kê lại.
            label = ""

            print(f"[PERSON] present={sorted(present)} missing={missing} "
                  f"helmet_on_head={helmet_on_head} -> "
                  f"{'VI PHẠM' if is_violation else 'AN TOÀN'}")

            final_detections.append({
                "id": f"worker-{p['id'] if p['id'] is not None else int(p['box'][0])}",
                "trackId": p['id'],
                "type": "person",
                "label": label,
                "confidence": float(p['conf']),
                "isViolation": is_violation,
                "confirmed": confirmed,  # đủ conf cao + đủ 3s liên tục -> mới nên ghi DB
                "missingPpe": missing,  # raw ('helmet'/'vest') để ghi DB, khỏi parse label tiếng Việt
                "bbox": self._bbox_pct(p['box'], frame),
            })

            # --- MỖI MÓN ĐÚNG MỘT KHUNG: xanh = CÓ, đỏ = THIẾU ---
            # Không còn khung thô của model, không còn hai trạng thái chồng nhau.
            # Vị trí khung lấy từ ĐIỂM KHỚP thật (cổ tay/cổ chân) nếu thấy, không
            # thấy thì suy từ khung người. Khớp nào ngoài khung hình -> bỏ, thà
            # thiếu khung còn hơn vẽ vào chỗ trống.
            def _kc_ok(i):
                return _k is not None and i < len(_k) and not (
                    _kc is not None and i < len(_kc) and _kc[i] < 0.5)

            def _dai(i, j):
                """Khoảng cách giữa hai khớp, dùng làm THƯỚC ĐO cho bộ phận đó."""
                if not (_kc_ok(i) and _kc_ok(j)):
                    return None
                return ((_k[i][0]-_k[j][0])**2 + (_k[i][1]-_k[j][1])**2) ** 0.5

            def _tu_khop(idx, khop_do=None, ti_le=0.20):
                """Khung ôm sát bộ phận tại điểm khớp `idx`.

                Cỡ khung lấy theo CHÍNH BỘ PHẬN đó (bàn tay đo theo cẳng tay, bàn
                chân đo theo cẳng chân), KHÔNG lấy theo chiều cao cả người. Lấy theo
                chiều cao người thì mọi khung bằng nhau và không co theo phối cảnh:
                người cúi xuống, tay đưa ra xa -> khung vẫn nguyên cỡ, dồn thành một
                cụm thay vì ôm sát từng bộ phận.
                """
                if not _kc_ok(idx):
                    return None
                cx, cy = _k[idx]
                if not (0 <= cx <= frame.shape[1] and 0 <= cy <= frame.shape[0]):
                    return None
                d = _dai(idx, khop_do) if khop_do is not None else None
                r = (d * ti_le) if d else ph * 0.030      # không đo được -> theo người
                r = max(min(r, ph * 0.05), 6)             # chặn quá to / quá nhỏ
                return [cx - r, cy - r, cx + r, cy + r]

            def _gop(a, b):
                """Gộp hai khung thành một khung ôm cả hai (bỏ qua khung None)."""
                cac = [q for q in (a, b) if q]
                if not cac:
                    return None
                return [min(q[0] for q in cac), min(q[1] for q in cac),
                        max(q[2] for q in cac), max(q[3] for q in cac)]

            def _bao_khop(idx_list, no_ngang, no_doc):
                """Khung ôm các điểm khớp cho trước, nới thêm cho vừa vật thật.

                Mũ và áo trước đây suy từ khung NGƯỜI nên ô to gấp mấy lần vật thật
                (khung mũ rộng 40% khung hình, gấp mấy lần cái đầu). Điểm khớp
                (mũi/mắt/tai cho đầu, vai/hông cho thân) bám sát hơn hẳn.
                """
                if _k is None:
                    return None
                pts = []
                for i in idx_list:
                    if i >= len(_k):
                        continue
                    if _kc is not None and i < len(_kc) and _kc[i] < 0.5:
                        continue
                    pts.append(_k[i])
                if not pts:
                    return None
                xs = [q[0] for q in pts]; ys = [q[1] for q in pts]
                w = max(max(xs) - min(xs), pw * 0.10)
                h = max(max(ys) - min(ys), ph * 0.06)
                return [min(xs) - w * no_ngang, min(ys) - h * no_doc,
                        max(xs) + w * no_ngang, max(ys) + h * no_doc]

            # ĐẦU: mũi + hai mắt + hai tai, nới lên trên để ôm cả phần sọ/mũ.
            _dau = head_region
            # THÂN: hai vai + hai hông — đúng vùng mặc áo phản quang.
            _than = _bao_khop([5, 6, 11, 12], 0.15, 0.10) or \
                    [px1 + pw * 0.18, py1 + ph * 0.22, px2 - pw * 0.18, py1 + ph * 0.62]

            # món -> (tên hiển thị, các khung để vẽ)
            _mon_khung = {
                'helmet': ('MŨ', [head_helmet_box if helmet_on_head else _dau]),
                'vest':   ('ÁO', [_than]),
                # MỖI BÀN TAY / BÀN CHÂN một khung RIÊNG. Gộp hai bên vào một khung
                # thì khi dang tay ra, khung phải bao cả khoảng giữa -> to đùng,
                # che kín người. Khung riêng thì nhỏ và bám đúng từng bàn tay.
                # bàn tay đo theo cẳng tay (khuỷu 7/8 -> cổ tay 9/10)
                # bàn chân đo theo cẳng chân (gối 13/14 -> cổ chân 15/16)
                'gloves': ('GĂNG', [b for b in (_tu_khop(9, 7), _tu_khop(10, 8)) if b]),
                'boots':  ('GIÀY', [b for b in (_tu_khop(15, 13, 0.22),
                                                _tu_khop(16, 14, 0.22)) if b]),
            }
            for _mon, (_ten, _khung_list) in _mon_khung.items():
                if _mon not in self.required_ppe:
                    continue
                # CHƯA KẾT LUẬN ĐƯỢC (còn trong thời gian quan sát, chưa thấy món
                # đó lần nào) -> KHÔNG VẼ GÌ. Trước đây rơi vào nhánh "không thiếu"
                # nên vẽ XANH, thành ra tay trần của anh vẫn hiện "GĂNG" màu xanh.
                # Chưa biết thì im lặng, không được nói là có.
                if _mon in chua_ket_luan:
                    continue
                _thieu = _mon in missing
                for _n, _hop in enumerate(_khung_list):
                    if _hop is None:
                        continue
                    final_detections.append({
                        "id": f"ppe-{_mon}-{p['id'] if p['id'] is not None else int(px1)}-{_n}",
                        "type": "ppe",
                        "label": (f"THIẾU {_ten}" if _thieu else _ten),
                        "confidence": float(p['conf']),
                        "isViolation": _thieu,
                        "bbox": self._bbox_pct(_hop, frame),
                    })

        return final_detections
