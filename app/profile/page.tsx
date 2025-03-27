"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Paper,
  Typography,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  InputAdornment,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

const ProfilePage = () => {
  const [userData, setUserData] = useState<any>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const router = useRouter();
  const FIREBASE_FUNCTIONS_BASE_URL = "YOUR FUNCTIONS BASE URL";

  useEffect(() => {
    const storedData = localStorage.getItem("userData");
    if (storedData) {
      const parsedData = JSON.parse(storedData);
      console.log("Stored userData:", parsedData);
      setUserData(parsedData);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("loggedIn");
    localStorage.removeItem("userData");
    router.push("/");
  };

  const handleOpenDialog = () => setOpenDialog(true);

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  const validatePassword = (password: string) => {
    // Regex: Minimum eight characters, at least one uppercase letter and one number
    const regex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
    return regex.test(password);
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      alert("Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      alert("New password and confirm password do not match.");
      return;
    }
    if (!validatePassword(newPassword)) {
      alert("New password must be at least 8 characters long and include at least one uppercase letter and one number.");
      return;
    }
  
    // Compute the userId using the stored userData
    const userId = userData.username || userData.name.trim().split(" ").join("").toLowerCase();
  
    try {
      const payload = {
        userId,
        oldPassword,
        newPassword,
      };
      console.log("Payload being sent:", payload);
  
      const response = await fetch(`${FIREBASE_FUNCTIONS_BASE_URL}/changePassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
  
      const data = await response.json();
      if (response.ok) {
        alert("Password updated successfully!");
        handleCloseDialog();
      } else {
        alert("Error: " + data.error);
      }
    } catch (error) {
      console.error("Error updating password:", error);
      alert("There was an error updating your password. Please try again.");
    }
  };

  if (!userData) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Typography variant="h6" color="textSecondary">
          Loading...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ backgroundColor: "#f3f4f6", minHeight: "100vh", p: 2 }}>
      {/* Sleek Fixed Back Button */}
      <Box
        sx={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 1000,
        }}
      >
        <IconButton
          onClick={() => router.back()}
          sx={{
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            "&:hover": { backgroundColor: "rgba(255, 255, 255, 1)" },
          }}
        >
          <ArrowBackIcon fontSize="medium" />
        </IconButton>
      </Box>

      {/* Main Content */}
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Paper
          elevation={3}
          sx={{
            p: 4,
            borderRadius: 2,
            width: { xs: "90%", sm: "400px" },
            textAlign: "center",
          }}
        >
          <Typography variant="h4" component="h1" color="#333" gutterBottom>
            IARA
          </Typography>
          <Typography variant="body1" gutterBottom>
            <strong>Name:</strong> {userData.name}
          </Typography>
          <Typography variant="body1" gutterBottom>
            <strong>Role:</strong> {userData.role}
          </Typography>
          <Typography variant="body1" gutterBottom>
            <strong>Email:</strong> {userData.email}
          </Typography>
          <Button variant="outlined" onClick={handleOpenDialog} sx={{ mt: 2 }}>
            Change Password
          </Button>
          <Box sx={{ mt: 3 }}>
            <Button variant="contained" color="error" onClick={handleLogout} fullWidth>
              Logout
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* Change Password Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Old Password"
            type={showOldPassword ? "text" : "password"}
            fullWidth
            variant="outlined"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowOldPassword(!showOldPassword)} edge="end">
                    {showOldPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            margin="dense"
            label="New Password"
            type={showNewPassword ? "text" : "password"}
            fullWidth
            variant="outlined"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowNewPassword(!showNewPassword)} edge="end">
                    {showNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            margin="dense"
            label="Confirm New Password"
            type={showConfirmNewPassword ? "text" : "password"}
            fullWidth
            variant="outlined"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)} edge="end">
                    {showConfirmNewPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleChangePassword} variant="contained">
            Update Password
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProfilePage;
