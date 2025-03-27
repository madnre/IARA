
IARA: An Integrated Attendance and Room Access System

IARA is a QR code-based IoT solution designed to streamline attendance monitoring and room access management in educational institutions. The project combines a Progressive Web App (PWA), Firebase services, and an ESP32-CAM module to enable secure attendance logging and automated door locking/unlocking.

    Note: Some files and configurations are intentionally excluded from this repo (for security or other reasons). You will need to create or replace these files yourself for a fully functional setup.

Table of Contents

    Overview

    Features

    Project Structure

    Missing or Excluded Files

    Installation

    Usage

    Technologies and Components

    Contributing

    License

    Authors

    Contact

Overview

IARA (Integrated Attendance and Room Access) aims to:

    Automate attendance tracking via QR code scans.

    Secure classroom access using a solenoid lock controlled by an ESP32-CAM.

    Provide real-time monitoring of attendance logs, including time-in and time-out.

    Simplify administrative tasks for teachers and school administrators.

Using a Progressive Web App (PWA) built with React and Next.js, students and teachers can generate or scan unique QR codes for attendance. The backend uses Firebase Realtime Database and Cloud Functions for data processing and authentication. An ESP32-CAM (running the code found in qrcodetest1) scans the QR codes at the door and triggers a solenoid lock to grant or deny entry based on valid credentials.
Features

    QR Code Attendance
    Each student and teacher has a unique QR code. Scanning it logs attendance in real time.

    Automated Door Access
    The solenoid lock opens upon successful QR code validation, restricting access to authorized users only.

    Real-Time Data
    Attendance logs are immediately written to Firebase, making them accessible for reporting and analytics.

    Progressive Web App
    The React/Next.js app can be installed on various devices and works across multiple browsers.

    Role-Based Access
    Administrators can add, edit, or remove classes and users; teachers can view attendance records; students can see their schedules and attendance logs.

Project Structure

Below is a simplified overview of the key folders and files in this repository:

├── admin-app/
│   ├── ... (React/Next.js Admin Dashboard)
│   └── ...
├── user-app/
│   ├── ... (React/Next.js PWA for students and teachers)
│   └── ...
├── qrcodetest1/
│   ├── src/
│   │   ├── main.cpp        # ESP32-CAM firmware (QR code scanning logic)
│   │   └── ...            
│   └── platformio.ini      # PlatformIO configuration
├── firebase/
│   ├── functions/
│   │   └── index.js        # Firebase Cloud Functions
│   └── ...
├── README.md
└── ...

Notable Directories

    admin-app/: Source code for the administrator-facing dashboard, where admins can manage users, classes, and access logs.

    user-app/: Source code for the Progressive Web App used by teachers and students for attendance and viewing schedules.

    qrcodetest1/: Code specific to the ESP32-CAM module. This firmware handles QR code scanning and communicates with Firebase to verify attendance and trigger the solenoid lock.

    firebase/: Contains Firebase configuration, Cloud Functions, and other server-side code.

Missing or Excluded Files

Certain files are excluded from the repository for security or other project-specific reasons. Examples may include:

    Firebase Configuration Files (e.g., serviceAccountKey.json, .env files)

    Sensitive API Keys or credentials for third-party services (SendGrid, etc.)

    Production Build Scripts or deployment configs

    Important: You must create or obtain these missing files yourself before the system will work in your environment. Refer to the Installation steps for guidance on what’s needed.

Installation

    Disclaimer: This project is not ready to run out of the box. You must supply the missing configuration files and adapt certain scripts or environment variables to your setup.

    Clone the Repository

git clone https://github.com/YourUsername/IARA-System.git
cd IARA-System

Set Up Firebase

    Create a Firebase project at Firebase Console.

    Enable Realtime Database, Authentication, and (optionally) Firestore if you plan to use it for additional features.

    Generate service account credentials and store them securely.

    Update your .env files or Firebase config in both the admin-app and user-app directories (these files are intentionally missing, so create them as needed).

Install Dependencies (Frontend)

cd admin-app
npm install
cd ../user-app
npm install

Install Dependencies (Firebase Functions)

    cd ../firebase/functions
    npm install

    Set Up the ESP32-CAM (qrcodetest1)

        Install PlatformIO or use the PlatformIO VS Code extension.

        In the qrcodetest1 folder, open the project in PlatformIO.

        Configure your Wi-Fi SSID and password in src/main.cpp (or environment variables as needed).

        Connect your ESP32-CAM via USB-to-serial adapter and upload the firmware.

    Note: Due to missing config files, certain build scripts or environment variables must be provided manually.

Usage

    Run the Admin Dashboard

cd admin-app
npm run dev

    Access the admin panel at http://localhost:3000.

Run the User PWA

cd user-app
npm run dev

    Access the user-facing PWA at http://localhost:3001 (or whichever port is specified).

Deploy Firebase Functions (optional for local testing)

    cd ../firebase/functions
    firebase deploy --only functions

    ESP32-CAM Operation

        Power on the ESP32-CAM with the uploaded qrcodetest1 firmware.

        The device connects to your configured Wi-Fi and listens for QR codes.

        When a valid QR code is detected, the system logs attendance to Firebase and triggers the solenoid lock.

Technologies and Components
Component	Role	Details	Documentation Link
Firebase Realtime DB	Data Storage & Real-Time Sync	Stores attendance records, user info, class schedules.	Firebase Realtime Database
Firebase Cloud Functions	Serverless Functions	Runs custom logic on events (QR scan, user creation, etc.).	Cloud Functions
React	Frontend UI	Builds dynamic user interfaces for the admin panel and user PWA.	React
Next.js	Server-Side Rendering & Routing	Enhances the React app by providing SSR and routing.	Next.js
SendGrid	Email Notifications	Sends automated emails (e.g., account creation, alerts).	SendGrid
ESP32-CAM (qrcodetest1)	Firmware & QR Code Scanning	Scans QR codes, communicates with Firebase to log attendance, triggers solenoid lock.	ESP32-CAM Docs
PlatformIO & Libraries	Embedded/IoT Development Environment	Manages build, upload, and library dependencies for the ESP32-CAM.	PlatformIO
Contributing

Contributions are welcome! To contribute:

    Fork the repository and create your branch from main.

    Commit your changes with clear messages.

    Push to your fork and submit a pull request.

Please make sure to update tests and documentation as appropriate.
License

This project is licensed under the MIT License. You’re free to use and modify the code, but please provide attribution to the original authors.
Authors

    Your Name – @YourGitHubUsername

    Team Members – @Member1, @Member2

Special thanks to everyone who contributed to this project, including mentors and peers who provided feedback and testing assistance.
Contact

For questions, suggestions, or feedback:

    Email: youremail@example.com

    GitHub Issues: Create a new issue

Feel free to open an issue or submit a pull request!

Thank you for checking out IARA! Some configuration files and credentials are missing by design. Please provide these files yourself to fully deploy and test the system.
