# Logo và màu sắc WalletWarden

<img src="logo-192.png" width="96" alt="WalletWarden logo">

Logo chính thức: chú heo đất đang giận. Phong cách: trắng, xanh lá, nền xanh dương đậm. Mã màu lấy trực tiếp từ logo.

## File

| File | Dùng cho |
|---|---|
| `logo.png` (1024×1024, góc bo tròn, nền trong suốt) | file gốc: README, slide, tài liệu |
| `logo-512.png`, `logo-192.png` | icon PWA (`purpose: any`) |
| `logo-maskable-512.png` (nền đậm phủ kín) | icon PWA `purpose: maskable` (Android tự cắt tròn/bo góc) |
| `logo-180.png` | `apple-touch-icon` (iPhone "Thêm vào màn hình chính") |
| `logo-64.png`, `logo-32.png`, `favicon.ico` | favicon, logo nhỏ trên thanh điều hướng |

## Bảng màu

| Token | Mã | Dùng cho |
|---|---|---|
| `navy` | `#0E2F51` | màu chủ đạo: header, sidebar, chữ tiêu đề, nền màn hình chào |
| `navy-900` | `#0B2440` | nền dark mode |
| `navy-50` | `#E8EEF5` | nền thẻ phụ, hàng xen kẽ trong bảng |
| `green` | `#36AB66` | nút chính, thanh ngân sách còn an toàn, icon, điểm nhấn |
| `green-700` | `#1F7A45` | **chữ/link xanh lá trên nền trắng** (màu `green` gốc không đủ tương phản) |
| `green-50` | `#E9F6EE` | nền thông báo tốt, chip "trong ngân sách" |
| `white` | `#FFFFFF` | nền chính |
| `surface` | `#F5F8FA` | nền trang phía sau các thẻ |
| `warning` | `#F2B84B` | ngân sách ≥ 80% (dùng làm nền, chữ màu `navy`) |
| `danger` | `#C0392B` | vượt ngân sách, lỗi, xoá |

Độ tương phản đã kiểm tra theo WCAG:

| Cặp màu | Tỉ lệ | Kết quả |
|---|---|---|
| `navy` trên trắng | 13,6 | đạt |
| `green-700` trên trắng | 5,35 | đạt |
| `navy` trên `green` (chữ trên nút chính) | 4,65 | đạt AA |
| `danger` trên trắng | 5,44 | đạt |
| `green` trên trắng | 2,93 | **không đạt**: không dùng cho chữ, chỉ dùng cho nền nút, icon, thanh tiến độ |
| trắng trên `green` | 2,93 | **không đạt**: nút chính dùng chữ `navy`, không dùng chữ trắng |

## Màu theo giọng roast

| Giọng | Nền | Viền / chữ |
|---|---|---|
| Gentle | `green-50` | viền `green`, chữ `navy` |
| Honest | `navy-50` | viền `navy`, chữ `navy` |
| Savage | `navy` (giống logo) | chữ trắng, viền `green`, icon heo giận |
