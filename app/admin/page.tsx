"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, remove, update } from "firebase/database";
import bcrypt from "bcryptjs"; // Add this at the top

// Material UI components
import {
  Box,
  AppBar,
  Tabs,
  Tab,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  OutlinedInput, FormGroup, FormControlLabel,
  Checkbox,
  ListItemText,
  Snackbar,
} from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";

// Firebase configuration (ideally move these to environment variables)
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

// Type definitions
interface ClassData {
  name: string;
  time: string;
  days: string[];
  room: string;
  teacher: string;
  archiveClass?: boolean; // <-- New property for archiving
}

interface UserData {
  name: string;
  password: string;
  email: string;
  role: "student" | "teacher" | "admin";
  enrolledClasses?: { [classId: string]: { attendance: boolean; attendanceLogs?: any } };
}

// A helper component for tab panels
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} id={`tabpanel-${index}`} {...other}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

// Predefined options for days of the week
const WEEK_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const AdminDashboard = () => {
  const router = useRouter();
  const [tabIndex, setTabIndex] = useState(0);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // States for classes
  const [classes, setClasses] = useState<{ [id: string]: ClassData }>({});
  const [newClass, setNewClass] = useState<ClassData>({
    name: "",
    time: "",
    days: [],
    room: "",
    teacher: "",
    archiveClass: false,
  });
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [editClassId, setEditClassId] = useState<string | null>(null);

  // States for users
  const [users, setUsers] = useState<{ [id: string]: UserData }>({});
  const [newUser, setNewUser] = useState({
    name: "",
    password: "",
    role: "student",
    email: "",
  });
  const [editUserId, setEditUserId] = useState<string | null>(null);

  // States for enrollment
  const [selectedStudent, setSelectedStudent] = useState<string>("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const teachers = Object.entries(users).filter(([_, userData]) => userData.role === "teacher");
  const students = Object.entries(users).filter(([_, userData]) => userData.role === "student");

  // Snackbar close handler
  const handleSnackbarClose = () => setSnackbarMessage("");

  const handleUnenroll = (studentId: string, classId: string) => {
    const studentClassRef = ref(database, `logins/${studentId}/enrolledClasses/${classId}`);
    remove(studentClassRef)
      .then(() => {
        setSnackbarMessage("Student unenrolled successfully.");
      })
      .catch((error) => {
        console.error("Error unenrolling student:", error);
      });
  };
  const handleTileClick = (classId: string) => {
    const classInfo = classes[classId];
    if (classInfo) {
      router.push(
        `/attendance?classId=${encodeURIComponent(classId)}&className=${encodeURIComponent(
          classInfo.name
        )}&teacher=${encodeURIComponent(classInfo.teacher)}`
      );
    }
  };

  // Fetch classes from Firebase
  useEffect(() => {
    const classesRef = ref(database, "classes");
    onValue(classesRef, (snapshot) => {
      setClasses(snapshot.val() || {});
    });
  }, []);

  // Fetch users from Firebase
  useEffect(() => {
    const usersRef = ref(database, "logins");
    onValue(usersRef, (snapshot) => {
      setUsers(snapshot.val() || {});
    });
  }, []);

  // -----------------------------
  // Classes: Create / Update / Delete
  // -----------------------------
  // In your handleClassSubmit function, update the conflict check:
  const handleClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Combine start and end times into a time range string.
    const timeRange = `${startTime} - ${endTime}`;

    // Create the class data object.
    const classData: ClassData = {
      ...newClass,
      time: timeRange,
      archiveClass: false,
    };

    // Helper function to convert "HH:mm" to minutes from midnight.
    const timeToMinutes = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(":").map(Number);
      return hours * 60 + minutes;
    };
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      setSnackbarMessage("Start time must be earlier than end time.");
      return;
    }
    // Check for scheduling conflicts in existing classes.
    // Note: Archived classes are ignored in the conflict check.
    const conflict = Object.entries(classes).find(([id, cls]) => {
      // Skip comparing with the class being edited.
      if (editClassId && id === editClassId) return false;

      // Ignore archived classes.
      if (cls.archiveClass) return false;

      // Check if the room is the same.
      if (cls.room !== newClass.room) return false;

      // Check for overlapping days.
      const dayOverlap = cls.days.some((day: string) => newClass.days.includes(day));
      if (!dayOverlap) return false;

      // Parse existing class's time range.
      const [existingStart, existingEnd] = cls.time.split(" - ");

      // Convert both new and existing times to minutes.
      const newStartMinutes = timeToMinutes(startTime);
      const newEndMinutes = timeToMinutes(endTime);
      const existingStartMinutes = timeToMinutes(existingStart);
      const existingEndMinutes = timeToMinutes(existingEnd);

      // Two intervals [a, b] and [c, d] overlap if a < d and c < b.
      return newStartMinutes < existingEndMinutes && existingStartMinutes < newEndMinutes;
    });

    // If a conflict is found, prompt the user to reschedule.
    if (conflict) {
      setSnackbarMessage("Please reschedule class");
      return;
    }

    // If no conflict, proceed to update or create the class.
    if (editClassId) {
      update(ref(database, `classes/${editClassId}`), classData);
      setSnackbarMessage("Class updated successfully.");
    } else {
      const newClassId = `class_${Date.now()}`;
      set(ref(database, `classes/${newClassId}`), classData)
        .then(() => {
          setSnackbarMessage("Class created successfully.");
          // Automatically enroll the teacher in the class if one is selected.
          if (newClass.teacher) {
            update(ref(database, `logins/${newClass.teacher}/enrolledClasses`), {
              [newClassId]: { attendance: false, attendanceLogs: {} },
            });
          }
        })
        .catch((error) => {
          console.error("Error creating class:", error);
        });
    }

    // Reset states.
    setNewClass({ name: "", time: "", days: [], room: "", teacher: "", archiveClass: false });
    setStartTime("");
    setEndTime("");
    setEditClassId(null);
  };

  const handleClassDelete = (classId: string) => {
    if (confirm("Are you sure you want to delete this class?")) {
      remove(ref(database, `classes/${classId}`))
        .then(() => {
          const usersRef = ref(database, "logins");
          onValue(
            usersRef,
            (snapshot) => {
              const allUsers = snapshot.val() || {};
              Object.keys(allUsers).forEach((userId) => {
                if (
                  allUsers[userId].enrolledClasses &&
                  allUsers[userId].enrolledClasses[classId]
                ) {
                  update(ref(database, `logins/${userId}/enrolledClasses`), {
                    [classId]: null,
                  });
                }
              });
            },
            { onlyOnce: true }
          );
          setSnackbarMessage("Class deleted and removed from users' enrollments.");
        })
        .catch((error) => {
          console.error("Error deleting class:", error);
        });
    }
  };

  const handleClassEdit = (classId: string) => {
    setEditClassId(classId);
    const cls = classes[classId];
    setNewClass(cls);
    const [start, end] = cls.time.split(" - ");
    setStartTime(start || "");
    setEndTime(end || "");
    setTabIndex(0);
  };

  // New function: Toggle archive status for a class
  const handleArchiveToggle = (classId: string) => {
    const cls = classes[classId];
    const currentStatus = cls.archiveClass || false;

    // If the class is archived and you want to unarchive it,
    // run a conflict check against all active classes.
    if (currentStatus) {
      // Helper function to convert "HH:mm" to minutes.
      const timeToMinutes = (timeStr: string) => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        return hours * 60 + minutes;
      };

      // Parse the class's time range.
      const [start, end] = cls.time.split(" - ");
      const classStartMinutes = timeToMinutes(start);
      const classEndMinutes = timeToMinutes(end);

      // Get all active classes (ignore the one we're unarchiving).
      const activeClasses = Object.entries(classes).filter(
        ([id, classData]) => id !== classId && !classData.archiveClass
      );

      // Check for conflicts with any active class.
      const conflict = activeClasses.find(([id, activeClass]) => {
        // Check if the room is the same.
        if (activeClass.room !== cls.room) return false;

        // Check if at least one day overlaps.
        const dayOverlap = activeClass.days.some((day: string) =>
          cls.days.includes(day)
        );
        if (!dayOverlap) return false;

        // Parse the active class's time range.
        const [activeStart, activeEnd] = activeClass.time.split(" - ");
        const activeStartMinutes = timeToMinutes(activeStart);
        const activeEndMinutes = timeToMinutes(activeEnd);

        // Check for overlapping time intervals.
        return (
          classStartMinutes < activeEndMinutes &&
          activeStartMinutes < classEndMinutes
        );
      });

      if (conflict) {
        setSnackbarMessage("Cannot unarchive class due to schedule conflict.");
        return;
      }
    }

    // Proceed to toggle archive status.
    update(ref(database, `classes/${classId}`), { archiveClass: !currentStatus })
      .then(() => {
        setSnackbarMessage(
          !currentStatus ? "Class archived successfully." : "Class unarchived successfully."
        );
      })
      .catch((error) => {
        console.error("Error updating archive status:", error);
      });
  };

  // -----------------------------
  // Users: Create / Update / Delete
  // -----------------------------
  const FIREBASE_FUNCTIONS_BASE_URL = "https://us-central1-thesis1-d9ca1.cloudfunctions.net";

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
  
    // For new users, generate a username from the provided name.
    // For updates, use the existing user ID (editUserId) as the username.
    const username = !editUserId
      ? newUser.name.split(" ").join("").toLowerCase()
      : editUserId;
  
    // Check for username duplication when creating a new user.
    if (!editUserId && users[username]) {
      setSnackbarMessage("A user with this username already exists.");
      return;
    }
  
    // Check for email duplication for new users.
    if (!editUserId) {
      const emailDuplicate = Object.entries(users).some(
        ([, userData]) => userData.email === newUser.email
      );
      if (emailDuplicate) {
        setSnackbarMessage("A user with this email already exists.");
        return;
      }
    }
  
    // Base URL for Firebase Cloud Functions.
    const FIREBASE_FUNCTIONS_BASE_URL = "https://us-central1-thesis1-d9ca1.cloudfunctions.net";
  
    if (!editUserId) {
      // New user creation: generate a random password.
      const plainPassword = generateRandomPassword(10);
      newUser.password = plainPassword; // Send this plain text password; the cloud function will hash it.
  
      try {
        // Call the createUser Cloud Function.
        const createResponse = await fetch(`${FIREBASE_FUNCTIONS_BASE_URL}/createUser`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newUser.name,
            email: newUser.email,
            password: newUser.password, // The cloud function will hash this.
            role: newUser.role,
            username, // generated username
          }),
        });
        const createResult = await createResponse.json();
        if (createResponse.ok) {
          setSnackbarMessage("User created successfully.");
        } else {
          setSnackbarMessage("Error creating user: " + createResult.error);
          return;
        }
  
        // After creating the user, send an email with the plain text password.
        const emailResponse = await fetch(`${FIREBASE_FUNCTIONS_BASE_URL}/sendEmail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: newUser.email,
            username, // generated username
            password: plainPassword,
          }),
        });
        const emailResult = await emailResponse.json();
        if (!emailResponse.ok) {
          console.error("Email sending error:", emailResult.error);
        }
      } catch (error) {
        console.error("Error creating user:", error);
        setSnackbarMessage("Error creating user.");
        return;
      }
    } else {
      // Updating an existing user: keep the original username (editUserId).
      try {
        const updateResponse = await fetch(`${FIREBASE_FUNCTIONS_BASE_URL}/updateUser`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            editUserId,
            name: newUser.name,
            email: newUser.email,
            password: newUser.password, // If a new password is provided, it will be hashed on the server.
            role: newUser.role,
            username, // Here, username is the same as editUserId.
          }),
        });
        const updateResult = await updateResponse.json();
        if (updateResponse.ok) {
          setSnackbarMessage("User updated successfully.");
          // Optionally, send an email notifying the user of their updated credentials.
          await fetch(`${FIREBASE_FUNCTIONS_BASE_URL}/sendEmail`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: newUser.email,
              username, // remains unchanged
              password: newUser.password,
            }),
          });
        } else {
          setSnackbarMessage("Error updating user: " + updateResult.error);
          return;
        }
      } catch (error) {
        console.error("Error updating user:", error);
        setSnackbarMessage("Error updating user.");
        return;
      }
    }
  
    // Clear form and reset editing state.
    setNewUser({ name: "", password: "", role: "student", email: "" });
    setEditUserId(null);
  };



  const handleUserDelete = (userId: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      remove(ref(database, `logins/${userId}`));
      setSnackbarMessage("User deleted.");
    }
  };

  const handleUserEdit = (userId: string) => {
    setEditUserId(userId);
    const userData = users[userId];
    setNewUser({
      name: userData.name,
      email: userData.email,
      role: userData.role,
      password: "",
    });
    setTabIndex(1);
  };

  // -----------------------------
  // Enrollment: Enroll Student into a Class
  // -----------------------------
  const handleEnroll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || selectedStudents.length === 0) {
      alert("Please select a class and at least one student.");
      return;
    }

    // Check if the selected class is archived
    if (classes[selectedClass]?.archiveClass) {
      setSnackbarMessage("Cannot enroll in an archived class.");
      return;
    }

    // Loop through each selected student and update enrollment
    selectedStudents.forEach((studentId) => {
      update(ref(database, `logins/${studentId}/enrolledClasses`), {
        [selectedClass]: { attendance: false, attendanceLogs: {} },
      });
    });

    setSnackbarMessage("Students enrolled successfully.");
    setSelectedStudents([]);  // reset checklist
  };
  // -----------------------------
  // Handle tab changes
  // -----------------------------
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  const generateRandomPassword = (length: number = 10): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  return (
    <Box
      sx={{
        backgroundColor: "#f3f4f6",
        minHeight: "100vh",
        py: 4,
        px: { xs: 2, sm: 4 },
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          maxWidth: 900,
          mx: "auto",
          mb: 4,
          p: 2,
          backgroundColor: "#fff",
          borderRadius: "10px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h5" color="#333">
          Admin Dashboard
        </Typography>
        <Box
          sx={{ cursor: "pointer" }}
          onClick={() => router.push("/profile")}
          title="View Profile"
        >
          <AccountCircleIcon sx={{ fontSize: 40, color: "#333" }} />
        </Box>
      </Box>

      {/* Main Container */}
      <Box
        sx={{
          maxWidth: 900,
          mx: "auto",
          backgroundColor: "#fff",
          borderRadius: "10px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <AppBar
          position="static"
          sx={{
            backgroundColor: "#333",
            borderTopLeftRadius: "10px",
            borderTopRightRadius: "10px",
          }}
        >
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            centered
            textColor="inherit"
            sx={{
              "& .MuiTab-root": { color: "#white" },
              "& .Mui-selected": { color: "white" },
              "& .MuiTabs-indicator": { backgroundColor: "#333" },
            }}
          >
            <Tab label="Classes" />
            <Tab label="Users" />
            <Tab label="Enrollment" />
          </Tabs>
        </AppBar>

        <TabPanel value={tabIndex} index={0}>
          {/* Classes Tab */}
          <Box
            component="form"
            onSubmit={handleClassSubmit}
            sx={{
              p: 2,
              borderBottom: "1px solid #eee",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Class Name"
                  value={newClass.name}
                  onChange={(e) =>
                    setNewClass({ ...newClass, name: e.target.value })
                  }
                  required
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  label="Start Time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 300 }}
                  required
                />
              </Grid>
              <Grid item xs={6} sm={3}>
                <TextField
                  fullWidth
                  label="End Time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 300 }}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth variant="outlined" required>
                  <InputLabel id="days-label">Days</InputLabel>
                  <Select
                    labelId="days-label"
                    multiple
                    value={newClass.days}
                    onChange={(e) =>
                      setNewClass({
                        ...newClass,
                        days:
                          typeof e.target.value === "string"
                            ? e.target.value.split(",")
                            : e.target.value,
                      })
                    }
                    input={<OutlinedInput label="Days" />}
                    renderValue={(selected) => (selected as string[]).join(", ")}
                  >
                    {WEEK_DAYS.map((day) => (
                      <MenuItem key={day} value={day}>
                        <Checkbox checked={newClass.days.indexOf(day) > -1} />
                        <ListItemText primary={day} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth variant="outlined" required>
                  <InputLabel id="room-label">Room</InputLabel>
                  <Select
                    labelId="room-label"
                    label="Room"
                    value={newClass.room}
                    onChange={(e) =>
                      setNewClass({ ...newClass, room: e.target.value })
                    }
                  >
                    <MenuItem value="Test Room 1">Test Room 1</MenuItem>
                    <MenuItem value="Test Room 2">Test Room 2</MenuItem>
                    <MenuItem value="Test Room 3">Test Room 3</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth variant="outlined" required>
                  <InputLabel id="teacher-label">Teacher</InputLabel>
                  <Select
                    labelId="teacher-label"
                    label="Teacher"
                    value={newClass.teacher}
                    onChange={(e) =>
                      setNewClass({ ...newClass, teacher: e.target.value })
                    }
                  >
                    {Object.entries(users)
                      .filter(([_, user]) => user.role === "teacher")
                      .map(([id, user]) => (
                        <MenuItem key={id} value={id}>
                          {user.name}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Button
              type="submit"
              variant="contained"
              sx={{ backgroundColor: "#333", mt: 1 }}
            >
              {editClassId ? "Update Class" : "Add Class"}
            </Button>
          </Box>

          {(() => {
            // Separate the classes into active and archived.
            const activeClasses = Object.entries(classes).filter(
              ([, classData]) => !classData.archiveClass
            );
            const archivedClasses = Object.entries(classes).filter(
              ([, classData]) => classData.archiveClass
            );
            return (
              <>
                {/* Active Classes */}
                <Typography variant="h6" sx={{ color: "#333", mt: 2, ml: 2 }}>
                  Active Classes
                </Typography>
                <Grid container spacing={2} sx={{ p: 2 }}>
                  {activeClasses.map(([id, classData]) => (
                    <Grid item xs={12} sm={6} key={id}>
                      <Card
                        variant="outlined"
                        sx={{
                          borderRadius: "10px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                          backgroundColor: "#fff",
                          cursor: "pointer",
                          "&:hover": { backgroundColor: "#f5f5f5" },
                        }}
                        onClick={() => handleTileClick(id)}
                      >
                        <CardContent>
                          <Typography variant="h6" sx={{ color: "#333" }}>
                            {classData.name}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {classData.time} | {classData.room}
                          </Typography>
                          <Typography variant="body2">
                            Teacher:{" "}
                            {users[classData.teacher]
                              ? users[classData.teacher].name
                              : classData.teacher}
                          </Typography>
                          <Typography variant="caption">
                            Days: {classData.days.join(", ")}
                          </Typography>
                        </CardContent>
                        <CardActions>
                          <Button
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClassEdit(id);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClassDelete(id);
                            }}
                          >
                            Delete
                          </Button>
                          <Button
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveToggle(id);
                            }}
                          >
                            Archive
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>

                {/* Archived Classes */}
                <Typography variant="h6" sx={{ color: "#333", mt: 2, ml: 2 }}>
                  Archived Classes
                </Typography>
                <Grid container spacing={2} sx={{ p: 2 }}>
                  {archivedClasses.map(([id, classData]) => (
                    <Grid item xs={12} sm={6} key={id}>
                      <Card
                        variant="outlined"
                        sx={{
                          borderRadius: "10px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                          backgroundColor: "#f0f0f0",
                        }}
                      >
                        <CardContent>
                          <Typography variant="h6" sx={{ color: "#333" }}>
                            {classData.name}{" "}
                            <Typography
                              component="span"
                              variant="caption"
                              sx={{ ml: 1, color: "red" }}
                            >
                              (Archived)
                            </Typography>
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {classData.time} | {classData.room}
                          </Typography>
                          <Typography variant="body2">
                            Teacher:{" "}
                            {users[classData.teacher]
                              ? users[classData.teacher].name
                              : classData.teacher}
                          </Typography>
                          <Typography variant="caption">
                            Days: {classData.days.join(", ")}
                          </Typography>
                        </CardContent>
                        <CardActions>
                          <Button
                            size="small"
                            onClick={() => handleArchiveToggle(id)}
                          >
                            Unarchive
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            onClick={() => handleClassDelete(id)}
                          >
                            Delete
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </>
            );
          })()}
        </TabPanel>


        <TabPanel value={tabIndex} index={1}>
          {/* Users Form */}
          <Box
            component="form"
            onSubmit={handleUserSubmit}
            sx={{
              p: 2,
              borderBottom: "1px solid #eee",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Full Name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  required
                  variant="outlined"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                  variant="outlined"
                />
              </Grid>
              {editUserId && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required
                    variant="outlined"
                  />
                </Grid>
              )}
              {!editUserId && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="textSecondary">
                    A random password will be generated for the new user.
                  </Typography>
                </Grid>
              )}
              <Grid item xs={12}>
                <FormControl fullWidth variant="outlined" required>
                  <InputLabel id="role-label">Role</InputLabel>
                  <Select
                    labelId="role-label"
                    label="Role"
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser({ ...newUser, role: e.target.value as "student" | "teacher" })
                    }
                  >
                    <MenuItem value="student">Student</MenuItem>
                    <MenuItem value="teacher">Teacher</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <Button type="submit" variant="contained" sx={{ backgroundColor: "#333", mt: 1 }}>
              {editUserId ? "Update User" : "Add User"}
            </Button>
          </Box>
          {/* Teachers List */}
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ color: "#333", mb: 1 }}>
              Teachers
            </Typography>
            <Grid container spacing={2}>
              {teachers.map(([id, userData]) => (
                <Grid item xs={12} sm={6} key={id}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: "10px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" sx={{ color: "#333" }}>
                        {userData.name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {userData.role.toUpperCase()}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        User ID: {id}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {userData.email}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button size="small" onClick={() => handleUserEdit(id)}>
                        Edit
                      </Button>
                      <Button size="small" color="error" onClick={() => handleUserDelete(id)}>
                        Delete
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
          {/* Students List */}
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ color: "#333", mb: 1 }}>
              Students
            </Typography>
            <Grid container spacing={2}>
              {students.map(([id, userData]) => (
                <Grid item xs={12} sm={6} key={id}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: "10px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                    }}
                  >
                    <CardContent>
                      <Typography variant="h6" sx={{ color: "#333" }}>
                        {userData.name}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {userData.role.toUpperCase()}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        User ID: {id}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {userData.email}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button size="small" onClick={() => handleUserEdit(id)}>
                        Edit
                      </Button>
                      <Button size="small" color="error" onClick={() => handleUserDelete(id)}>
                        Delete
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </TabPanel>

        <TabPanel value={tabIndex} index={2}>
  {/* Enrollment Form */}
  <Box component="form" onSubmit={handleEnroll} sx={{ p: 2 }}>
    <Grid container spacing={2}>
      {/* Left column: Students */}
      <Grid item xs={12}>
        {/* Label + search box */}
        <Typography variant="subtitle1" sx={{ color: "black", mb: 1 }}>
          Select Students
        </Typography>

        <TextField
          label="Search Student"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 2 }}
          // Make sure text is black
          inputProps={{ style: { color: "black" } }}
          InputLabelProps={{ style: { color: "black" } }}
        />

        {/* Box styled to mimic an outlined input */}
        <Box
          sx={{
            border: "1px solid rgba(0, 0, 0, 0.23)",
            borderRadius: 1,
            p: 2,
            maxHeight: 300,
            overflow: "auto",
          }}
        >
          <FormGroup>
            {Object.entries(users)
              .filter(([id, user]) => {
                // Only include students
                if (user.role !== "student") return false;

                // Filter by searchTerm (case-insensitive)
                if (
                  searchTerm &&
                  !user.name.toLowerCase().includes(searchTerm.toLowerCase())
                ) {
                  return false;
                }

                // Exclude already enrolled if a class is selected
                if (selectedClass && user.enrolledClasses) {
                  return !user.enrolledClasses.hasOwnProperty(selectedClass);
                }
                return true;
              })
              .map(([id, user]) => (
                <FormControlLabel
                  key={id}
                  // Make label text black
                  sx={{ color: "black" }}
                  control={
                    <Checkbox
                      // Make checkbox icon black
                      sx={{ color: "black" }}
                      checked={selectedStudents.includes(id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudents([...selectedStudents, id]);
                        } else {
                          setSelectedStudents(
                            selectedStudents.filter((sid) => sid !== id)
                          );
                        }
                      }}
                    />
                  }
                  label={
                    <span style={{ color: "black" }}>
                      {user.name}
                    </span>
                  }
                />
              ))}
          </FormGroup>
        </Box>
      </Grid>

      {/* Right column: Class selection */}
      <Grid item xs={12}>
        <FormControl fullWidth required>
          <InputLabel id="class-label" sx={{ color: "black" }}>
            Class
          </InputLabel>
          <Select
            labelId="class-label"
            label="Class"
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            sx={{
              color: "black",
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "black",
              },
            }}
            // Force black text inside the dropdown
            MenuProps={{
              PaperProps: {
                sx: {
                  color: "black",
                },
              },
            }}
          >
            <MenuItem value="">
              <em>Select a Class</em>
            </MenuItem>
            {Object.entries(classes)
              .filter(([id, classData]) => {
                // Exclude archived classes
                if (classData.archiveClass) return false;
                // If a single-student mode was used, exclude classes that student is already in
                if (selectedStudent && users[selectedStudent]?.enrolledClasses) {
                  return !users[selectedStudent].enrolledClasses.hasOwnProperty(id);
                }
                return true;
              })
              .map(([id, classData]) => (
                <MenuItem key={id} value={id}>
                  {classData.name}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </Grid>
    </Grid>

    {/* Enroll button */}
    <Box sx={{ mt: 2 }}>
      <Button type="submit" variant="contained" sx={{ backgroundColor: "#333" }}>
        Enroll Selected Students
      </Button>
    </Box>
  </Box>

  {/* Unenroll Section */}
  <Box sx={{ p: 2, borderTop: "1px solid #eee", mt: 2 }}>
    <Typography variant="h6" sx={{ mb: 2, color: "black" }}>
      Enrolled Students in Selected Class
    </Typography>
    {selectedClass ? (
      <Grid container spacing={2}>
        {Object.entries(users)
          .filter(
            ([, user]) =>
              user.role === "student" &&
              user.enrolledClasses &&
              user.enrolledClasses[selectedClass]
          )
          .map(([studentId, user]) => (
            <Grid item xs={12} sm={6} key={studentId}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: "10px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ color: "#333" }}>
                    {user.name}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleUnenroll(studentId, selectedClass)}
                  >
                    Unenroll
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
      </Grid>
    ) : (
      <Typography variant="body2" sx={{ color: "black" }}>
        Please select a class to view enrolled students.
      </Typography>
    )}
  </Box>
</TabPanel>
      </Box>

      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
      />
    </Box>
  );
};

export default AdminDashboard;
