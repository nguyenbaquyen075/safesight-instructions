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
    PART_MIN_CONF = {'gloves': 0.25, 'boots': 0.20}
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

    def __init__(self,
                 model_path: str = 'ppe_v8s_custom.pt',
                 confidence: float = 0.5,
                 min_height_ratio: float = 0.10,
                 required_ppe = ('helmet', 'vest'),
                 imgsz: int = 480):
        """Initialize tracking system with newly trained model.

        min_height_ratio: chỉ xét đối tượng CHÍNH ở gần (box cao >= tỉ lệ này so
        với khung hình). Đối tượng chuyển động ở xa (người/xe nền) có box nhỏ sẽ
        bị bỏ qua. Tăng giá trị -> bỏ qua nhiều hơn; giảm -> bắt cả vật xa hơn.

        required_ppe: danh sách PPE BẮT BUỘC. Người thiếu bất kỳ món nào -> VI PHẠM
        (khung đỏ). Mặc định bắt buộc mũ + áo. Găng/giày CHƯA bật mặc định — đã thử
        thêm 'gloves'/'boots' vào required_ppe và test bằng camera thật: model gần
        như KHÔNG BAO GIỜ nhận ra người đang đeo găng/giày (tỉ lệ detect dương tính
        quá thấp so với mũ/áo), nên bật lên sẽ báo vi phạm oan ~mọi người ~liên tục.
        Cần model detect gang/giày tốt hơn (train lại) trước khi bật mặc định.
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

        # trackId -> thời điểm ĐẦU TIÊN thấy người này vi phạm liên tục (để tính CONFIRM_DELAY).
        # ponytail: dict không tự dọn track đã rời khung hình lâu -> phình dần theo phiên chạy dài;
        # nếu chạy 24/7 thì thêm bước dọn định kỳ (vd theo max_age của tracker).
        self._violation_since = {}
        # trackId -> {tên PPE: lần cuối NHÌN THẤY món đó trên người này}
        # ponytail: cùng vấn đề dọn rác như _violation_since ở trên, dọn chung một thể.
        self._ppe_last_seen = {}

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

        # --- Tầng 1: khung từng bộ phận ---
        for it in items:
            # MŨ xử lý riêng ở Tầng 2 (chỉ tính khi ĐỘI trên đầu). Mũ treo/cầm/để chỗ
            # khác -> KHÔNG vẽ khung ở đây, tránh nhiễu (đúng ý: không đội thì bắt làm gì).
            if it['name'] in ('helmet', 'no_helmet'):
                continue
            is_viol = it['name'].startswith('no_')
            base = it['name'][3:] if is_viol else it['name']  # no_helmet -> helmet

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

            # Giày: KHÔNG còn khung ước lượng bịa vị trí — model không thấy rõ thì
            # không vẽ, tránh khung sai chỗ (khung thật đã vẽ ở Tầng 1 nếu có).

        return final_detections
