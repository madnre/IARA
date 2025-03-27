IARA: Integrated Attendance & Room Access System

A QR code-based IoT solution that automates attendance tracking and secures room access in educational institutions. It combines a Progressive Web App (PWA) for user interactions and an ESP32-CAM firmware for QR scanning and solenoid lock control.
Features

    QR Code Attendance: Users scan unique codes to log presence in real time.

    Secure Room Access: Only authorized scans unlock the door.

    Modular Architecture: Separate folders for admin, attendance, and user profiles.

    ESP32-CAM Integration: Firmware handles scanning logic and hardware control.
```bash
iara/
├── app/
│   ├── admin/
│   ├── attendance/
│   ├── profile/
│   └── page/
└── qrcodetest1/
    └── src/
        └── main.cpp

    Note: Certain configuration files (e.g., Firebase keys) may be intentionally missing and must be provided separately.

