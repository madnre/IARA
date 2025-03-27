directory tree is formatted as code while the rest is plain text, so your Note and Thesis Paper sections are displayed correctly. Make sure you have a line break after the closing triple backticks.

# IARA: Integrated Attendance & Room Access System

A QR code-based IoT solution that automates attendance tracking and secures room access in educational institutions. It combines a Progressive Web App (PWA) for user interactions and an ESP32-CAM firmware for QR scanning and solenoid lock control.

## Directory Structure

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


### Important Details
1. **Closing Code Block**: Ensure there is a blank line after the closing ``` (three backticks) of your code block before writing regular text again.  
2. **Spacing**: Keep the indentation of the directory tree consistent.  
3. **Markdown File Extension**: Save the file as `README.md` (not `.txt` or another format) so GitH
