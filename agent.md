# 📄 agent.md – Voice-Control Music Web (Agentic AI - Python)

## 1. 🎯 Mục tiêu hệ thống

Xây dựng một ứng dụng web chạy trên **localhost** cho phép điều khiển trình phát nhạc bằng giọng nói.

Hệ thống sử dụng **Machine Learning cơ bản (KHÔNG dùng Deep Learning)** để nhận diện 6 lệnh:

| Lệnh     | Chức năng          |
| -------- | ------------------ |
| go       | Kích hoạt hệ thống |
| play     | Phát nhạc          |
| stop     | Dừng nhạc          |
| next     | Bài tiếp theo      |
| previous | Bài trước          |
| replay   | Phát lại bài       |

---

## 2. 🧠 Kiến trúc Agentic AI

Agent được thiết kế theo pipeline:

```
User Voice
   ↓
Audio Capture (Python)
   ↓
Feature Extraction (MFCC)
   ↓
ML Model (SVM / KNN)
   ↓
Command Prediction
   ↓
Music Controller (Web)
```

---

## 3. 🧩 Thành phần Agent

### 3.1 Perception (Nhận thức)

- Thu âm từ microphone
- Chuẩn hóa audio
- Trích xuất đặc trưng MFCC

```python
import librosa

def extract_features(file_path):
    y, sr = librosa.load(file_path, sr=None)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    return mfcc.mean(axis=1)
```

---

### 3.2 Decision (Ra quyết định)

- Sử dụng model ML đã train (SVM / KNN)

```python
command = model.predict([features])[0]
```

---

### 3.3 Action (Hành động)

Mapping command → hành động:

| Command  | Action        |
| -------- | ------------- |
| play     | audio.play()  |
| stop     | audio.pause() |
| next     | next song     |
| previous | previous song |
| replay   | phát lại      |

---

## 4. 🔗 Tích hợp Model

### Đường dẫn model:

```python
MODEL_PATH = "models/voice_command_model.pkl"
```

👉 Có thể thay model mới bằng cách:

- Ghi đè file `.pkl`
- Không cần sửa code

---

### Load model:

```python
import joblib
model = joblib.load(MODEL_PATH)
```

---

## 5. ⚙️ Backend (Flask)

### API: `/predict`

- Method: POST
- Input: file `.wav`
- Output:

```json
{
  "command": "play"
}
```

---

### Code backend:

```python
from flask import Flask, request, jsonify
import joblib
import librosa

app = Flask(__name__)

MODEL_PATH = "models/voice_command_model.pkl"
model = joblib.load(MODEL_PATH)

def extract_features(file_path):
    y, sr = librosa.load(file_path, sr=None)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    return mfcc.mean(axis=1)

@app.route("/predict", methods=["POST"])
def predict():
    file = request.files["audio"]
    file_path = "temp.wav"
    file.save(file_path)

    features = extract_features(file_path)
    command = model.predict([features])[0]

    return jsonify({"command": command})

if __name__ == "__main__":
    app.run(debug=True)
```

---

## 6. 🌐 Frontend

### Công nghệ:

- HTML + CSS + JS (đơn giản)

---

### Gửi request:

```javascript
fetch("/predict", {
  method: "POST",
  body: formData,
})
  .then((res) => res.json())
  .then((data) => handleCommand(data.command));
```

---

## 7. 🎵 Music Controller

```javascript
function handleCommand(cmd) {
  switch (cmd) {
    case "play":
      audio.play();
      break;
    case "stop":
      audio.pause();
      break;
    case "next":
      nextSong();
      break;
    case "previous":
      prevSong();
      break;
    case "replay":
      audio.currentTime = 0;
      audio.play();
      break;
  }
}
```

---

## 8. 🔄 Logic Agent

Trạng thái hệ thống:

```
IDLE → ACTIVE
```

### Quy tắc:

- Chỉ khi nói `"go"` → hệ thống ACTIVE
- Nếu chưa ACTIVE → bỏ qua lệnh

---

## 9. 🧪 Training Model

- 6 classes: go, play, stop, next, previous, replay
- Feature: MFCC
- Model:
  - SVM (khuyến nghị)
  - KNN

---

## 10. 🚀 Cách chạy

### Cài thư viện:

```bash
pip install flask librosa scikit-learn joblib
```

### Chạy server:

```bash
python app.py
```

### Mở web:

```
http://127.0.0.1:5000
```

---

## 11. 📈 Hướng cải tiến

- Tăng dữ liệu train
- Thêm noise augmentation
- Thêm lệnh mới
- Realtime streaming

---

## 12. 🔗 Liên kết hệ thống

| File      | Vai trò        |
| --------- | -------------- |
| skill.md  | mô tả khả năng |
| design.md | UI             |
| agent.md  | pipeline AI    |

---

## 13. 📁 Cấu trúc project

```
project/
│
├── app.py
├── models/
│   └── voice_command_model.pkl
├── static/
│   └── music/
├── templates/
│   └── index.html
└── agent.md
```

---

## 14. ✅ Tổng kết

- Sử dụng Machine Learning cơ bản
- Không dùng Deep Learning
- Tập trung pipeline AI + tích hợp model
- Web đơn giản, dễ chạy trên VS Code

---
