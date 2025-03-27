# IARA: Integrated Attendance & Room Access System

A QR code-based IoT solution that automates attendance tracking and secures room access. It combines a Progressive Web App (PWA) for user interactions and an ESP32-CAM firmware for QR scanning and solenoid lock control.

## Main File Templates

```bash
iara/
├── app/
│   ├── admin/         # Admin dashboard components
│   ├── attendance/    # Attendance logging and display
│   ├── profile/       # User profile and account details
│   └── page/          # Main UI or routing
│
├── index.js           # Cloud functions
│
└── qrcodetest1/
    └── src/
        └── main.cpp   # ESP32-CAM firmware (QR scanning logic)
```
Note: Certain configuration files (e.g., Firebase keys) may be intentionally missing and must be provided separately.

## Thesis Reference
For more detailed information about this project, refer to:
[Thesis Paper](https://docs.google.com/document/d/100LYfCMeaMxzbtgm6SQikcMHMUZzHtNrxQ6-6_-wNYI/edit?usp=sharing)
