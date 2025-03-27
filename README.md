IARA: Integrated Attendance & Room Access System

A QR code-based IoT solution that automates attendance tracking and secures room access in educational institutions. It combines a Progressive Web App (PWA) for user interactions and an ESP32-CAM firmware for QR scanning and solenoid lock control.


```bash
iara/
├── app/
│   ├── admin/         # Admin dashboard components
│   ├── attendance/    # Attendance logging and display
│   ├── profile/       # User profile and account details
│   └── page/          # Main UI or routing
└── qrcodetest1/
    └── src/
        └── main.cpp   # ESP32-CAM firmware (QR scanning logic)

Note: Certain configuration files (e.g., Firebase keys) may be intentionally missing and must be provided separately.

Thesis Paper

For a comprehensive overview of the system’s design, methodology, and evaluation, please refer to the Thesis Document.
[Thesis Document](https://docs.google.com/document/d/100LYfCMeaMxzbtgm6SQikcMHMUZzHtNrxQ6-6_-wNYI/edit?tab=t.0)
