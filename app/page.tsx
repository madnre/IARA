"use client";

import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue } from "firebase/database";
import { QRCodeCanvas } from "qrcode.react";
import {
  Dialog,
  Tabs,
  Tab,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import QrCodeIcon from "@mui/icons-material/QrCode";
import bcrypt from "bcryptjs";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "thesis1-d9ca1.firebaseapp.com",
  databaseURL:
    "https://thesis1-d9ca1-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "thesis1-d9ca1",
  storageBucket: "thesis1-d9ca1.appspot.com",
  messagingSenderId: "580502261923",
  appId: "1:580502261923:web:118e25db3891bd8f1bef16",
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Helper function to convert a string to hexadecimal
function stringToHex(str: string): string {
  let hexStr = "";
  for (let i = 0; i < str.length; i += 1) {
    const hex = str.charCodeAt(i).toString(16).padStart(2, "0");
    hexStr += hex;
  }
  return hexStr;
}

interface UserData {
  name: string;
  password: string;
  role: "teacher" | "student" | "admin";
  enrolledClasses?: { [classId: string]: { attendance: number } };
}

interface ClassData {
  name: string;
  time: string;
  days: string[];
  room: string;
  teacher: string;
  archiveClass?: boolean;
}

// Simple TabPanel component for rendering tab content
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const BASE_LOCKOUT_TIME = 5; // seconds

const App = () => {
  // Authentication and user state
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loggedIn, setLoggedIn] = useState<boolean>(() =>
    typeof window !== "undefined" && localStorage.getItem("loggedIn") === "true"
  );
  const [userData, setUserData] = useState<UserData | null>(() => {
    if (typeof window !== "undefined") {
      const storedData = localStorage.getItem("userData");
      return storedData ? JSON.parse(storedData) : null;
    }
    return null;
  });

  // New state for captcha checkbox
  const [captchaChecked, setCaptchaChecked] = useState<boolean>(false);

  // Data state
  const [classes, setClasses] = useState<{ [classId: string]: ClassData }>({});
  const [loginsData, setLoginsData] = useState<{ [key: string]: UserData }>({});

  // QR Code dialog state
  const [qrData, setQrData] = useState<string>("");
  const [isQrDialogOpen, setIsQrDialogOpen] = useState<boolean>(false);
  // Ref for the QR code canvas element
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Attendance dialog state
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState<boolean>(false);
  const [attendeeList, setAttendeeList] = useState<string[]>([]);

  // Forgot Password / Contact Admin dialog state (manual open/close)
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState<boolean>(false);

  // Max Login Attempts lockout dialog state (auto-close with timer)
  const [isLockoutOpen, setIsLockoutOpen] = useState<boolean>(false);
  const [lockoutTime, setLockoutTime] = useState<number>(0);

  // Tab state – default is "Today's Schedule"
  const [selectedTab, setSelectedTab] = useState<number>(0);

  // Login attempts counter
  const [loginAttempts, setLoginAttempts] = useState<number>(0);

  const router = useRouter();

  // Redirect admin users
  useEffect(() => {
    if (loggedIn && userData && userData.role === "admin") {
      router.push("/admin");
    }
  }, [loggedIn, userData, router]);

  // Listen for changes in the logged-in user's data from Firebase
  useEffect(() => {
    if (loggedIn && username) {
      const userRef = ref(database, `logins/${username}`);
      onValue(userRef, (snapshot) => {
        const updatedUserData = snapshot.val();
        if (updatedUserData) {
          setUserData({ ...updatedUserData });
          localStorage.setItem("userData", JSON.stringify(updatedUserData));
        }
      });
    }
  }, [loggedIn, username]);

  // Fetch classes and logins from Firebase
  useEffect(() => {
    const fetchClasses = () => {
      return new Promise<{ [key: string]: ClassData }>((resolve) => {
        const classesRef = ref(database, "classes");
        onValue(classesRef, (snapshot) => {
          resolve(snapshot.val() || {});
        });
      });
    };

    const fetchLogins = () => {
      return new Promise<{ [key: string]: UserData }>((resolve) => {
        const loginsRef = ref(database, "logins");
        onValue(loginsRef, (snapshot) => {
          resolve(snapshot.val() || {});
        });
      });
    };

    Promise.all([fetchClasses(), fetchLogins()]).then(
      ([classData, allLogins]) => {
        const updatedClasses = Object.entries(classData).reduce(
          (acc, [classId, classInfo]) => {
            if (classInfo.archiveClass) return acc;
            const teacherUsername = classInfo.teacher;
            const teacherName = allLogins[teacherUsername]?.name || teacherUsername;
            acc[classId] = { ...classInfo, teacher: teacherName };
            return acc;
          },
          {} as { [key: string]: ClassData }
        );

        setClasses(updatedClasses);
        setLoginsData(allLogins);
      }
    );
  }, []);

  // Handle login with prompt for missing credentials and captcha verification
  const handleLogin = () => {
    if (!username || !password) {
      alert("Please enter credentials");
      return;
    }
    if (!captchaChecked) {
      alert("Please verify that you're not a robot");
      return;
    }
    const loginRef = ref(database, `logins/${username}`);
    onValue(
      loginRef,
      async (snapshot) => {
        const user = snapshot.val();
        if (user) {
          const match = await bcrypt.compare(password, user.password);
          if (match) {
            // Successful login: reset attempts
            setLoginAttempts(0);
            user.username = username;
            setLoggedIn(true);
            setUserData(user);
            localStorage.setItem("loggedIn", "true");
            localStorage.setItem("userData", JSON.stringify(user));
            if (user.role === "admin") {
              router.push("/admin");
            }
          } else {
            // Failed login: increment attempts and show lockout if attempts >= 3.
            const attempts = loginAttempts + 1;
            setLoginAttempts(attempts);
            alert("Invalid username or password");
            if (attempts >= 3) {
              // Timer duration doubles for each additional attempt past 3.
              const timerDuration = BASE_LOCKOUT_TIME * Math.pow(2, attempts - 3);
              setLockoutTime(timerDuration);
              setIsLockoutOpen(true);
            }
          }
        } else {
          const attempts = loginAttempts + 1;
          setLoginAttempts(attempts);
          alert("Invalid username or password");
          if (attempts >= 3) {
            const timerDuration = BASE_LOCKOUT_TIME * Math.pow(2, attempts - 3);
            setLockoutTime(timerDuration);
            setIsLockoutOpen(true);
          }
        }
      },
      { onlyOnce: true }
    );
  };

  // Lockout timer effect for Max Login Attempts dialog
  useEffect(() => {
    if (isLockoutOpen && lockoutTime > 0) {
      const intervalId = setInterval(() => {
        setLockoutTime((prev) => {
          if (prev <= 1) {
            clearInterval(intervalId);
            setIsLockoutOpen(false);
            // Do NOT reset loginAttempts here to allow increasing lockout duration.
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(intervalId);
    }
  }, [isLockoutOpen, lockoutTime]);

  // Generate QR code with hex-encoded user key
  const generateQRCode = () => {
    if (userData) {
      const loginsRef = ref(database, "logins");
      onValue(
        loginsRef,
        (snapshot) => {
          const allLogins = snapshot.val();
          const userKey = Object.keys(allLogins).find(
            (key) => allLogins[key].name === userData.name
          );
          if (userKey) {
            const userKeyHex = stringToHex(userKey);
            setQrData(userKeyHex);
            setIsQrDialogOpen(true);
          }
        },
        { onlyOnce: true }
      );
    }
  };

  // Download the QR code as a PNG image
  const downloadQR = () => {
    if (qrCanvasRef.current) {
      const originalCanvas = qrCanvasRef.current;
      const margin = 20;
      const { width, height } = originalCanvas;
      const newCanvas = document.createElement("canvas");
      newCanvas.width = width + margin * 2;
      newCanvas.height = height + margin * 2;
      const ctx = newCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
        ctx.drawImage(originalCanvas, margin, margin, width, height);
        const image = newCanvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = image;
        link.download = "qr-code.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  };

  // Navigate to the attendance page for a given class
  const handleTileClick = (classId: string) => {
    const classInfo = classes[classId];
    if (classInfo) {
      router.push(
        `/attendance?classId=${encodeURIComponent(
          classId
        )}&className=${encodeURIComponent(
          classInfo.name
        )}&teacher=${encodeURIComponent(classInfo.teacher)}`
      );
    }
  };

  const renderClassTile = (classId: string) => {
    const classData = classes[classId];
    if (!classData) return null;

    const enrolledUsers = Object.values(loginsData).filter(
      (userInfo) =>
        userInfo.enrolledClasses && userInfo.enrolledClasses[classId]
    );
    const enrolledStudents = enrolledUsers.filter(
      (userInfo) => userInfo.role === "student"
    );
    const totalStudents = enrolledStudents.length;

    return (
      <div
        key={classId}
        onClick={() => handleTileClick(classId)}
        style={{
          padding: "15px",
          backgroundColor: "#ffffff",
          borderRadius: "10px",
          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
          color: "#333",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 style={{ color: "#333", margin: 0 }}>{classData.name}</h3>
          <span
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: userData?.enrolledClasses?.[classId]?.attendance
                ? "#BDE7BD"
                : "#ccc",
            }}
          />
        </div>
        <p style={{ margin: 0 }}>
          <strong>Time:</strong> {classData.time}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Days:</strong> {classData.days.join(", ")}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Room:</strong> {classData.room}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Teacher:</strong> {classData.teacher}
          <span
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: enrolledUsers.some(
                (userInfo) =>
                  userInfo.role === "teacher" &&
                  Boolean(userInfo.enrolledClasses?.[classId]?.attendance)
              )
                ? "#BDE7BD"
                : "#ccc",
              marginLeft: "4px",
            }}
          />
        </p>
        <p
          style={{
            margin: 0,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
          onClick={(e) => {
            e.stopPropagation();
            const classList = enrolledStudents.map((userInfo) => userInfo.name);
            setAttendeeList(classList);
            setIsAttendanceDialogOpen(true);
          }}
        >
          <strong>
            Class List ({totalStudents} {totalStudents === 1 ? "student" : "students"})
          </strong>
          <span style={{ fontWeight: "bold" }}>›</span>
        </p>
      </div>
    );
  };

  const renderEnrolledClasses = () => {
    if (
      !userData ||
      !userData.enrolledClasses ||
      Object.keys(userData.enrolledClasses).length === 0
    ) {
      return (
        <div style={{ textAlign: "center", padding: "20px", color: "#333" }}>
          No classes yet.
        </div>
      );
    }
    return Object.keys(userData.enrolledClasses)
      .filter((classId) => classes[classId])
      .map((classId) => renderClassTile(classId));
  };

  const renderTodaysSchedule = () => {
    if (
      !userData ||
      !userData.enrolledClasses ||
      Object.keys(userData.enrolledClasses).length === 0
    ) {
      return (
        <div style={{ textAlign: "center", padding: "20px", color: "#333" }}>
          No classes yet.
        </div>
      );
    }
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const todayClassIds = Object.keys(userData.enrolledClasses).filter((classId) => {
      const classData = classes[classId];
      return classData && classData.days.includes(today);
    });
    if (todayClassIds.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "20px", color: "#333" }}>
          No classes scheduled for today.
        </div>
      );
    }
    return todayClassIds.map((classId) => renderClassTile(classId));
  };

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#f3f4f6",
        minHeight: "100vh",
      }}
    >
      {!loggedIn ? (
        <div
          style={{
            maxWidth: "400px",
            margin: "0 auto",
            padding: "20px",
            backgroundColor: "#ffffff",
            borderRadius: "10px",
            boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          }}
        >
          <h1 style={{ textAlign: "center", color: "#333" }}>Login</h1>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              margin: "10px 0",
              borderRadius: "5px",
              border: "1px solid #ccc",
              color: "#333",
            }}
          />
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "10px",
                margin: "10px 0",
                borderRadius: "5px",
                border: "1px solid #ccc",
                color: "#333",
              }}
            />
            <div
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                cursor: "pointer",
                color: "#333",
              }}
            >
              {showPassword ? <VisibilityOff /> : <Visibility />}
            </div>
          </div>
          <FormControlLabel
            control={
              <Checkbox
                checked={captchaChecked}
                onChange={(e) => setCaptchaChecked(e.target.checked)}
                style={{ color: "#333" }}
              />
            }
            label={<span style={{ color: "#000" }}>I&apos;m not a robot</span>}
          />
          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: "#333",
              color: "#ffffff",
              border: "none",
              borderRadius: "5px",
              cursor: "pointer",
            }}
          >
            Login
          </button>
          <p style={{ textAlign: "center", marginTop: "10px" }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setIsForgotPasswordOpen(true);
              }}
              style={{ color: "#0070f3", textDecoration: "underline", cursor: "pointer" }}
            >
              Forgot Password?
            </a>
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              color: "black",
            }}
          >
            <h2>Hello, {userData?.name}!</h2>
            <div style={{ cursor: "pointer" }} title="View Profile">
              <Link href="/profile" passHref>
                <AccountCircleIcon style={{ fontSize: "40px", color: "#333" }} />
              </Link>
            </div>
          </div>
          <Tabs
            value={selectedTab}
            onChange={(e, newValue) => setSelectedTab(newValue)}
            indicatorColor="primary"
            textColor="primary"
            centered
          >
            <Tab label="Today's Schedule" />
            <Tab label="Classes" />
          </Tabs>
          <TabPanel value={selectedTab} index={0}>
            {renderTodaysSchedule()}
          </TabPanel>
          <TabPanel value={selectedTab} index={1}>
            {renderEnrolledClasses()}
          </TabPanel>
        </>
      )}

      {loggedIn && (
        <button
          type="button"
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            backgroundColor: "#333",
            color: "#ffffff",
            border: "none",
            borderRadius: "50%",
            width: "60px",
            height: "60px",
            fontSize: "24px",
            cursor: "pointer",
          }}
          onClick={generateQRCode}
        >
          <QrCodeIcon style={{ fontSize: "32px", color: "#ffffff" }} />
        </button>
      )}

{/* QR Code Dialog */}
<Dialog open={isQrDialogOpen} onClose={() => setIsQrDialogOpen(false)}>
  <div style={{ padding: "20px", textAlign: "center" }}>
    <h2 style={{ color: "#333", marginBottom: "10px" }}>QR Code</h2>
    {qrData && (
      <div
  style={{
    maxWidth: "280px",
    width: "100%",
    margin: "0 auto",
    backgroundColor: "#fff", // white background
    padding: "10px", // space for the border
    border: "10px solid #fff", // explicit white border
    borderRadius: "4px",
  }}
>
  <QRCodeCanvas
    ref={qrCanvasRef}
    value={qrData}
    size={280}
    style={{
      width: "100%",
      height: "auto",
      display: "block",
    }}
  />
</div>
    )}
    <Button
      variant="contained"
      onClick={downloadQR}
      style={{ marginTop: "10px", backgroundColor: "#333" }}
    >
      Download QR Code
    </Button>
  </div>
</Dialog>

      {/* Attendee List Dialog */}
      <Dialog
        open={isAttendanceDialogOpen}
        onClose={() => setIsAttendanceDialogOpen(false)}
      >
        <div style={{ padding: "20px", textAlign: "center" }}>
          <h2 style={{ color: "#333", marginBottom: "10px" }}>Attendee List</h2>
          {attendeeList.length > 0 ? (
            <ul>
              {attendeeList.map((attendee, index) => (
                <li key={index} style={{ textAlign: "left" }}>
                  {attendee}
                </li>
              ))}
            </ul>
          ) : (
            <p>No attendees yet.</p>
          )}
        </div>
      </Dialog>

      {/* Forgot Password / Contact Admin Dialog */}
      <Dialog open={isForgotPasswordOpen} onClose={() => setIsForgotPasswordOpen(false)}>
        <div style={{ padding: "20px", textAlign: "center" }}>
          <h2 style={{ color: "#333", marginBottom: "10px" }}>Contact Admin</h2>
          <p>Please contact your administrator to reset your password.</p>
          <p>iara.system.1@gmail.com</p>
          <Button
            variant="contained"
            onClick={() => setIsForgotPasswordOpen(false)}
            style={{ marginTop: "20px", backgroundColor: "#333" }}
          >
            Close
          </Button>
        </div>
      </Dialog>

      {/* Max Login Attempts Lockout Dialog */}
      <Dialog open={isLockoutOpen} onClose={() => setIsLockoutOpen(false)}>
        <div style={{ padding: "20px", textAlign: "center" }}>
          <h2 style={{ color: "#333", marginBottom: "10px" }}>Login Locked</h2>
          <p>You have exceeded the maximum login attempts.</p>
          <p>
            Please wait <strong>{lockoutTime}</strong> second
            {lockoutTime !== 1 && "s"} before trying again.
          </p>
        </div>
      </Dialog>
    </div>
  );
};

export default App;
