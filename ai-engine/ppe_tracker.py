# SPDX-License-Identifier: MIT

import cv2
import numpy as np
import torch
from ultralytics import YOLO
from collections import defaultdict
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
    EVIDENCE_WINDOW = 2.0
    # GIỮ KHUNG găng/giày bao lâu sau lần cuối nhìn thấy. Model chỉ bắt được
    # ~65% số khung nên cứ 3 khung lại mất 1 -> khung nhấp nháy. Chẩn đoán 8/8
    # ca lỗi cho thấy model CÓ thấy nhưng conf 0.12-0.22 (dưới ngưỡng), tức chỉ
    # mờ đi chứ không mất. Giữ lại vị trí cũ, NEO THEO KHUNG NGƯỜI để nó chạy
    # cùng người thay vì đứng im khi người bước đi.
    # 2.0s: chọn bằng đo, không cảm tính. Trên samples1.mp4 (150 khung):
    #   1.0s -> găng 77% / giày 80% ; 1.5s -> 80/87 ; 2.0s -> 83/93 ; 3.0s -> 83/98
    # Găng bão hoà ở 2.0s. Chọn 3.0s chỉ thêm 5 điểm giày mà đổi lấy thêm 1 giây
    # mù khi người ta THÁO đồ ra. Đặt bằng EVIDENCE_WINDOW cho nhất quán.
    HOLD_SECONDS = 2.0

    def __init__(self,
                 model_path: str = 'ppe_v8s_custom.pt',
                 confidence: float = 0.5,
                 min_height_ratio: float = 0.10,
                 required_ppe = ('helmet', 'vest'),
                 imgsz: int = 480,
                 parts_model_path: str = None,
                 parts_classes = ('gloves', 'boots')):
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
        self.parts_classes = {c.lower() for c in parts_classes} if parts_model_path else set()
        self.parts_model = YOLO(parts_model_path).to(device) if parts_model_path else None
        if self.parts_model is not None:
            print(f"  + model phụ cho {sorted(self.parts_classes)}: {parts_model_path}")

        # trackId -> thời điểm ĐẦU TIÊN thấy người này vi phạm liên tục (để tính CONFIRM_DELAY).
        # ponytail: dict không tự dọn track đã rời khung hình lâu -> phình dần theo phiên chạy dài;
        # nếu chạy 24/7 thì thêm bước dọn định kỳ (vd theo max_age của tracker).
        self._violation_since = {}
        # trackId -> {tên PPE: lần cuối NHÌN THẤY món đó trên người này}
        # ponytail: cùng vấn đề dọn rác như _violation_since ở trên, dọn chung một thể.
        self._ppe_last_seen = {}
        # trackId -> {tên món: (hộp theo TỈ LỆ trong khung người, thời điểm, conf)}
        self._part_memory = {}

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

    def process_frame(self, frame: np.ndarray) -> list:
        """Process frame -> detections cho dashboard.

        2 tầng khung:
          1) Khung TỪNG BỘ PHẬN model thấy (mũ/áo/găng/giày...) — xanh, hoặc đỏ nếu là no_*.
          2) Khung TỪNG NGƯỜI — xét đủ/thiếu PPE bắt buộc: thiếu -> ĐỎ + VI PHẠM.
        """
        final_detections = []

        # augment=True (TTA): model chạy thêm ở nhiều tỉ lệ/lật ảnh rồi gộp kết quả.
        # Đo 150 frame samples1.mp4: frame BẮT ĐƯỢC GIÀY 44.7% -> 74.0% (găng đứng yên
        # ~75%). Giá phải trả: 14.5 -> 7.2 fps. Đổi tốc độ lấy chân, bỏ chữ này là về cũ.
        # iou=0.5 (mặc định 0.7): TTA đẻ box trùng (4 box cho 2 bàn chân) -> siết NMS
        # bớt 19% box thừa mà KHÔNG mất frame nào.
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
                persons.append({'box': box, 'id': track_id, 'conf': conf})
            else:
                items.append({'name': low, 'box': box, 'conf': conf})

            status = "VIOLATION" if low.startswith('no_') else "SAFE"
            print(f"[DETECT] {cls_name:10} | Conf: {conf:.2f} | Status: {status}")

        # Thay khung GĂNG/GIÀY bằng kết quả model phụ (nếu có). Chỉ đụng đúng
        # những lớp trong parts_classes — người/mũ/áo giữ nguyên của model chính.
        if self.parts_model is not None:
            def _base(n):
                return n[3:] if n.startswith('no_') else n
            items = [it for it in items if _base(it['name']) not in self.parts_classes]
            pr = self.parts_model.predict(frame, conf=self.confidence, imgsz=self.imgsz,
                                          augment=True, iou=0.5, verbose=False)[0]
            for box, cid, cf in zip(pr.boxes.xyxy.cpu().tolist(),
                                    pr.boxes.cls.int().cpu().tolist(),
                                    pr.boxes.conf.cpu().tolist()):
                nm = self.parts_model.names[cid].lower()
                base = nm[3:] if nm.startswith('no_') else nm
                if base not in self.parts_classes:
                    continue
                if (box[3] - box[1]) / frame.shape[0] < self.min_height_ratio:
                    continue
                items.append({'name': nm, 'box': box, 'conf': cf})

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

        # --- Tầng 1: khung từng bộ phận ---
        for it in items:
            # MŨ xử lý riêng ở Tầng 2 (chỉ tính khi ĐỘI trên đầu). Mũ treo/cầm/để chỗ
            # khác -> KHÔNG vẽ khung ở đây, tránh nhiễu (đúng ý: không đội thì bắt làm gì).
            if it['name'] in ('helmet', 'no_helmet'):
                continue
            is_viol = it['name'].startswith('no_')
            base = it['name'][3:] if is_viol else it['name']  # no_helmet -> helmet

            # KHÔNG vẽ khung đỏ buộc tội cho món KHÔNG nằm trong required_ppe.
            # Đo trên luồng camera thật: no_gloves ra 179 khung / no_helmet-style
            # nhiều hơn cả gloves (165), conf ngang nhau (p50 0.46 vs 0.52) -> model
            # lật qua lật lại trên cùng đôi tay, khung xanh/đỏ nhấp nháy. Mà lớp
            # no_gloves có mAP 0.003, no_goggle 0.041 — buộc tội bằng thứ đó là vô
            # căn cứ. Món không phạt thì chỉ hiện khung dương (xanh) cho anh xem.
            # KHÔNG vẽ khung đỏ từ lớp phủ định — nhưng VẪN để chúng tham gia quyết
            # định ở Tầng 2. Hai việc khác nhau: đo thử bỏ chúng khỏi quyết định thì
            # bỏ lọt vọt lên (găng 0.4%->3.5%, giày 1.6%->2.7%, vượt ngưỡng 2%), tức
            # dù mAP thấp (0.003-0.04) chúng vẫn góp phần bắt vi phạm thật.
            # Còn trên MÀN HÌNH thì chúng chỉ là nhiễu: 93 khung "THIẾU GĂNG" so với
            # 196 khung "GĂNG" trên cùng đoạn video. Nhãn của TỪNG NGƯỜI ở Tầng 2 đã
            # nói rõ ai thiếu gì rồi, không cần khung đỏ rời rạc chồng lên.
            # Vẽ khung đỏ cho món BẮT BUỘC bị thiếu (THIẾU GĂNG / THIẾU GIÀY...),
            # để anh nhìn thấy ngay chỗ nào trên người đang thiếu đồ — không chỉ có
            # một khung to bao cả người. Món KHÔNG bắt buộc thì bỏ qua, tránh khung
            # đỏ vô nghĩa (vd THIẾU KÍNH khi hệ thống không hề phạt kính).
            # Không vẽ khung từ lớp no_* nữa — găng/giày đã có khung theo vùng cơ
            # thể ở Tầng 2 (đúng chỗ, luôn có). Giữ lại chỉ gây khung lệch chồng lên.
            if is_viol:
                continue

            # GĂNG/GIÀY: box nhỏ dễ nhiễu -> chỉ vẽ khi đủ tin cậy (PART_MIN_CONF).
            # KHÔNG ép tâm khung phải nằm trong khung người: tay giơ lên/ra ngoài
            # thân (test cận cam, thao tác...) làm khung tay thò ra ngoài khung
            # người -> ép điều kiện này sẽ lọc mất tay/chân thật (đã gặp lỗi này).
            if it['conf'] < self.PART_MIN_CONF.get(base, self.OTHER_MIN_CONF):
                continue
            vn = self.PPE_VN.get(base, base.upper())
            label = f"THIẾU {vn}" if is_viol else vn
            final_detections.append({
                "id": f"item-{it['name']}-{int(it['box'][0])}-{int(it['box'][1])}",
                "type": "ppe",
                "label": label,
                "confidence": float(it['conf']),
                "isViolation": is_viol,
                "bbox": self._bbox_pct(it['box'], frame),
            })

        # --- Tầng 2: khung từng người + xét đủ/thiếu PPE ---
        for p in persons:
            px1, py1, px2, py2 = p['box']
            pw, ph = px2 - px1, py2 - py1
            # Vùng ĐẦU = phần trên của khung người (tự dịch theo người khi di chuyển).
            # MŨ chỉ HỢP LỆ khi TÂM mũ nằm trong vùng đầu này. Mũ cầm tay / treo / để
            # dưới đất -> KHÔNG tính là đội -> người này bị coi là THIẾU MŨ (vi phạm).
            # Nới rộng 2 bên + cao hơn đỉnh đầu 1 chút để ôm trọn mũ (mũ hay cao/lệch
            # hơn khung người -> nếu bó hẹp sẽ trượt mất mũ thật -> báo thiếu mũ oan).
            head_region = [px1 + pw * 0.05, py1 - ph * 0.08,
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
                if self._center_inside(it['box'], p['box']):
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

            missing = [req for req in self.required_ppe
                       if req in explicit_missing or req not in present]
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

            if is_violation:
                label = "THIẾU " + ", ".join(self.PPE_VN.get(m, m.upper()) for m in missing)
            else:
                label = "ĐỦ ĐỒ BẢO HỘ"

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

            # Khung ĐẦU (LUÔN hiện, bám theo người/mũ khi di chuyển):
            #  - Đội mũ bảo hộ đúng đầu  -> XANH, dùng CHÍNH khung mũ (bám sát cử động).
            #  - Không có mũ trên đầu    -> ĐỎ "THIẾU MŨ" + vi phạm (dù mũ có treo đâu đó).
            if helmet_on_head:
                final_detections.append({
                    "id": f"head-{p['id'] if p['id'] is not None else int(px1)}",
                    "type": "ppe",
                    "label": "MŨ BẢO HỘ",
                    "confidence": float(p['conf']),
                    "isViolation": False,
                    "bbox": self._bbox_pct(head_helmet_box, frame),
                })
            else:
                final_detections.append({
                    "id": f"head-{p['id'] if p['id'] is not None else int(px1)}",
                    "type": "ppe",
                    "label": "THIẾU MŨ",
                    "confidence": float(p['conf']),
                    "isViolation": True,
                    "bbox": self._bbox_pct(head_region, frame),
                })

            # THIẾU GĂNG / THIẾU GIÀY: vẽ khung theo VÙNG CƠ THỂ suy từ khung người,
            # giống hệt cách đang làm cho mũ (head_region) ở ngay trên.
            # Lý do: kết luận "thiếu" là THẬT (suy từ việc không thấy găng/giày trên
            # người này — đường tin cậy). Chỉ VỊ TRÍ khung là suy ra. Dựa vào lớp
            # no_gloves/no_boots để đặt khung thì hỏng: mAP 0.003/0.005, hộp lệch
            # lung tung (đã thấy 2 khung "THIẾU GĂNG" 55% và 40% chồng nhau lệch
            # khỏi bàn tay), và no_boots gần như không bao giờ ra nên chân KHÔNG
            # BAO GIỜ có khung. Suy từ hình người thì luôn đúng chỗ và luôn có.
            # Khung THIẾU GĂNG/GIÀY đặt theo ĐIỂM KHỚP THẬT (cổ tay, cổ chân).
            # Bộ phận nào không nhìn thấy (điểm khớp conf thấp, vd anh ngồi sát cam
            # nên tay/chân ngoài khung) thì KHÔNG VẼ — thà không có khung còn hơn
            # vẽ một ô vào chỗ trống rồi bảo "thiếu găng" ở đó.
            _kp = None
            _best = 0.4
            for _pb, _k, _kc in zip(_pose_boxes, _pose_kp,
                                    _pose_kc or [[1.0] * 17] * len(_pose_kp)):
                _x1, _y1 = max(_pb[0], px1), max(_pb[1], py1)
                _x2, _y2 = min(_pb[2], px2), min(_pb[3], py2)
                if _x2 <= _x1 or _y2 <= _y1:
                    continue
                _inter = (_x2 - _x1) * (_y2 - _y1)
                _u = (_pb[2]-_pb[0])*(_pb[3]-_pb[1]) + pw*ph - _inter
                if _u > 0 and _inter / _u > _best:
                    _best, _kp = _inter / _u, (_k, _kc)

            if _kp is not None:
                _k, _kc = _kp
                _r = max(ph * 0.06, 12)          # nửa cạnh khung, theo cỡ người
                _can = {'gloves': ('THIẾU GĂNG', (9, 10)),
                        'boots': ('THIẾU GIÀY', (15, 16))}
                for _mon, (_nhan, _idx) in _can.items():
                    if _mon not in missing:
                        continue
                    for _i in _idx:
                        if _i >= len(_k) or (_i < len(_kc) and _kc[_i] < 0.5):
                            continue                      # khớp không thấy -> bỏ
                        _cx, _cy = _k[_i]
                        if not (0 <= _cx <= frame.shape[1] and 0 <= _cy <= frame.shape[0]):
                            continue                      # ngoài khung hình -> bỏ
                        final_detections.append({
                            "id": f"kp-{_nhan}-{p['id'] if p['id'] is not None else int(px1)}-{_i}",
                            "type": "ppe",
                            "label": _nhan,
                            "confidence": float(_kc[_i]) if _i < len(_kc) else float(p['conf']),
                            "isViolation": True,
                            "bbox": self._bbox_pct([_cx - _r, _cy - _r, _cx + _r, _cy + _r], frame),
                        })

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
                persons.append({'box': box, 'id': track_id, 'conf': conf})
            else:
                items.append({'name': low, 'box': box, 'conf': conf})

            status = "VIOLATION" if low.startswith('no_') else "SAFE"
            print(f"[DETECT] {cls_name:10} | Conf: {conf:.2f} | Status: {status}")

        # Thay khung GĂNG/GIÀY bằng kết quả model phụ (nếu có). Chỉ đụng đúng
        # những lớp trong parts_classes — người/mũ/áo giữ nguyên của model chính.
        if self.parts_model is not None:
            def _base(n):
                return n[3:] if n.startswith('no_') else n
            items = [it for it in items if _base(it['name']) not in self.parts_classes]
            pr = self.parts_model.predict(frame, conf=self.confidence, imgsz=self.imgsz,
                                          augment=True, iou=0.5, verbose=False)[0]
            for box, cid, cf in zip(pr.boxes.xyxy.cpu().tolist(),
                                    pr.boxes.cls.int().cpu().tolist(),
                                    pr.boxes.conf.cpu().tolist()):
                nm = self.parts_model.names[cid].lower()
                base = nm[3:] if nm.startswith('no_') else nm
                if base not in self.parts_classes:
                    continue
                if (box[3] - box[1]) / frame.shape[0] < self.min_height_ratio:
                    continue
                items.append({'name': nm, 'box': box, 'conf': cf})

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

        # --- Tầng 1: khung từng bộ phận ---
        for it in items:
            # MŨ xử lý riêng ở Tầng 2 (chỉ tính khi ĐỘI trên đầu). Mũ treo/cầm/để chỗ
            # khác -> KHÔNG vẽ khung ở đây, tránh nhiễu (đúng ý: không đội thì bắt làm gì).
            if it['name'] in ('helmet', 'no_helmet'):
                continue
            is_viol = it['name'].startswith('no_')
            base = it['name'][3:] if is_viol else it['name']  # no_helmet -> helmet

            # KHÔNG vẽ khung đỏ buộc tội cho món KHÔNG nằm trong required_ppe.
            # Đo trên luồng camera thật: no_gloves ra 179 khung / no_helmet-style
            # nhiều hơn cả gloves (165), conf ngang nhau (p50 0.46 vs 0.52) -> model
            # lật qua lật lại trên cùng đôi tay, khung xanh/đỏ nhấp nháy. Mà lớp
            # no_gloves có mAP 0.003, no_goggle 0.041 — buộc tội bằng thứ đó là vô
            # căn cứ. Món không phạt thì chỉ hiện khung dương (xanh) cho anh xem.
            # KHÔNG vẽ khung đỏ từ lớp phủ định — nhưng VẪN để chúng tham gia quyết
            # định ở Tầng 2. Hai việc khác nhau: đo thử bỏ chúng khỏi quyết định thì
            # bỏ lọt vọt lên (găng 0.4%->3.5%, giày 1.6%->2.7%, vượt ngưỡng 2%), tức
            # dù mAP thấp (0.003-0.04) chúng vẫn góp phần bắt vi phạm thật.
            # Còn trên MÀN HÌNH thì chúng chỉ là nhiễu: 93 khung "THIẾU GĂNG" so với
            # 196 khung "GĂNG" trên cùng đoạn video. Nhãn của TỪNG NGƯỜI ở Tầng 2 đã
            # nói rõ ai thiếu gì rồi, không cần khung đỏ rời rạc chồng lên.
            # Vẽ khung đỏ cho món BẮT BUỘC bị thiếu (THIẾU GĂNG / THIẾU GIÀY...),
            # để anh nhìn thấy ngay chỗ nào trên người đang thiếu đồ — không chỉ có
            # một khung to bao cả người. Món KHÔNG bắt buộc thì bỏ qua, tránh khung
            # đỏ vô nghĩa (vd THIẾU KÍNH khi hệ thống không hề phạt kính).
            # Không vẽ khung từ lớp no_* nữa — găng/giày đã có khung theo vùng cơ
            # thể ở Tầng 2 (đúng chỗ, luôn có). Giữ lại chỉ gây khung lệch chồng lên.
            if is_viol:
                continue

            # GĂNG/GIÀY: box nhỏ dễ nhiễu -> chỉ vẽ khi đủ tin cậy (PART_MIN_CONF).
            # KHÔNG ép tâm khung phải nằm trong khung người: tay giơ lên/ra ngoài
            # thân (test cận cam, thao tác...) làm khung tay thò ra ngoài khung
            # người -> ép điều kiện này sẽ lọc mất tay/chân thật (đã gặp lỗi này).
            if it['conf'] < self.PART_MIN_CONF.get(base, self.OTHER_MIN_CONF):
                continue
            vn = self.PPE_VN.get(base, base.upper())
            label = f"THIẾU {vn}" if is_viol else vn
            final_detections.append({
                "id": f"item-{it['name']}-{int(it['box'][0])}-{int(it['box'][1])}",
                "type": "ppe",
                "label": label,
                "confidence": float(it['conf']),
                "isViolation": is_viol,
                "bbox": self._bbox_pct(it['box'], frame),
            })

        # --- Tầng 2: khung từng người + xét đủ/thiếu PPE ---
        for p in persons:
            px1, py1, px2, py2 = p['box']
            pw, ph = px2 - px1, py2 - py1
            # Vùng ĐẦU = phần trên của khung người (tự dịch theo người khi di chuyển).
            # MŨ chỉ HỢP LỆ khi TÂM mũ nằm trong vùng đầu này. Mũ cầm tay / treo / để
            # dưới đất -> KHÔNG tính là đội -> người này bị coi là THIẾU MŨ (vi phạm).
            # Nới rộng 2 bên + cao hơn đỉnh đầu 1 chút để ôm trọn mũ (mũ hay cao/lệch
            # hơn khung người -> nếu bó hẹp sẽ trượt mất mũ thật -> báo thiếu mũ oan).
            head_region = [px1 + pw * 0.05, py1 - ph * 0.08,
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
                if self._center_inside(it['box'], p['box']):
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

            missing = [req for req in self.required_ppe
                       if req in explicit_missing or req not in present]
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

            if is_violation:
                label = "THIẾU " + ", ".join(self.PPE_VN.get(m, m.upper()) for m in missing)
            else:
                label = "ĐỦ ĐỒ BẢO HỘ"

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

            # Khung ĐẦU (LUÔN hiện, bám theo người/mũ khi di chuyển):
            #  - Đội mũ bảo hộ đúng đầu  -> XANH, dùng CHÍNH khung mũ (bám sát cử động).
            #  - Không có mũ trên đầu    -> ĐỎ "THIẾU MŨ" + vi phạm (dù mũ có treo đâu đó).
            if helmet_on_head:
                final_detections.append({
                    "id": f"head-{p['id'] if p['id'] is not None else int(px1)}",
                    "type": "ppe",
                    "label": "MŨ BẢO HỘ",
                    "confidence": float(p['conf']),
                    "isViolation": False,
                    "bbox": self._bbox_pct(head_helmet_box, frame),
                })
            else:
                final_detections.append({
                    "id": f"head-{p['id'] if p['id'] is not None else int(px1)}",
                    "type": "ppe",
                    "label": "THIẾU MŨ",
                    "confidence": float(p['conf']),
                    "isViolation": True,
                    "bbox": self._bbox_pct(head_region, frame),
                })

            # THIẾU GĂNG / THIẾU GIÀY: vẽ khung theo VÙNG CƠ THỂ suy từ khung người,
            # giống hệt cách đang làm cho mũ (head_region) ở ngay trên.
            # Lý do: kết luận "thiếu" là THẬT (suy từ việc không thấy găng/giày trên
            # người này — đường tin cậy). Chỉ VỊ TRÍ khung là suy ra. Dựa vào lớp
            # no_gloves/no_boots để đặt khung thì hỏng: mAP 0.003/0.005, hộp lệch
            # lung tung (đã thấy 2 khung "THIẾU GĂNG" 55% và 40% chồng nhau lệch
            # khỏi bàn tay), và no_boots gần như không bao giờ ra nên chân KHÔNG
            # BAO GIỜ có khung. Suy từ hình người thì luôn đúng chỗ và luôn có.
            _vung = {}
            if 'gloves' in missing:
                # hai bàn tay: hai mép ngoài khung người, tầm 35-70% chiều cao
                _vung['THIẾU GĂNG'] = [
                    [px1, py1 + ph * 0.35, px1 + pw * 0.28, py1 + ph * 0.70],
                    [px2 - pw * 0.28, py1 + ph * 0.35, px2, py1 + ph * 0.70],
                ]
            if 'boots' in missing:
                # bàn chân: dải đáy khung người
                _vung['THIẾU GIÀY'] = [[px1, py2 - ph * 0.16, px2, py2]]
            for _nhan, _hop_list in _vung.items():
                for _j, _hop in enumerate(_hop_list):
                    final_detections.append({
                        "id": f"vung-{_nhan}-{p['id'] if p['id'] is not None else int(px1)}-{_j}",
                        "type": "ppe",
                        "label": _nhan,
                        "confidence": float(p['conf']),
                        "isViolation": True,
                        "bbox": self._bbox_pct(_hop, frame),
                    })

        return final_detections
