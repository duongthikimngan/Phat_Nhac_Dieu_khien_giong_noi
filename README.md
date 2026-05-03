# Voice-Control Music Web

Ứng dụng web chạy trên `localhost` để phát nhạc và điều khiển bằng giọng nói với model `.pkl` có sẵn trong repo.

## Chức năng

- Nhận diện 6 lệnh: `go`, `play`, `stop`, `next`, `back`, `replay`
- Chỉ thực thi lệnh điều khiển sau khi hệ thống được kích hoạt bằng `go`
- Micro hoạt động theo chế độ thủ công:
  - bấm `Bật micro`
  - nói đúng một lệnh
  - app tự dừng ghi, tắt hẳn micro rồi mới xử lý
- Hỗ trợ nạp playlist từ:
  - file người dùng chọn trực tiếp trên trình duyệt
  - thư mục `static/music/` trên server

## Cài đặt

```bash
pip install -r requirements.txt
```

## Chạy ứng dụng

```bash
python app.py
```

Mở:

```text
http://127.0.0.1:5000
```

## Cách dùng

1. Nạp file nhạc từ nút `Nạp nhạc từ máy`, hoặc chép file nhạc vào `static/music/`.
2. Bấm `Bật micro` và nói `go` để kích hoạt hệ thống.
3. Với mỗi lệnh tiếp theo, bấm `Bật micro` lại một lần rồi nói `play`, `stop`, `next`, `back` hoặc `replay`.

## Kiểm thử

```bash
python -m unittest -v
```

## Ghi chú kỹ thuật

- API nhận diện lệnh: `POST /predict`
- Kiểm tra backend: `GET /health`
- Lấy playlist mặc định: `GET /api/playlist`
- Giao diện đã được chuyển sang cơ chế bật/tắt mic thủ công để tránh việc stream tự mở lại sau khi ghi xong
