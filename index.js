const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");
const bcrypt = require("bcrypt");
const cors = require("cors")({ origin: true }); // Import and configure CORS

// Initialize Firebase Admin
admin.initializeApp();

// Set SendGrid API Key from Firebase Config
// (Make sure you run: firebase functions:config:set sendgrid.key="YOUR_SENDGRID_API_KEY")
sgMail.setApiKey(functions.config().sendgrid.key);

// ---------- Create User Function ----------
exports.createUser = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    try {
      const { name, email, password, role, username } = req.body;
      if (!name || !email || !password || !role || !username) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Hash the password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Prepare user data
      const userData = { name, email, password: hashedPassword, role };

      // Save to Realtime Database under "logins/username"
      await admin.database().ref(`logins/${username}`).set(userData);

      return res.status(200).json({ message: "User created successfully" });
    } catch (error) {
      console.error("Error creating user:", error);
      return res
        .status(500)
        .json({ error: "Error creating user", details: error.message });
    }
  });
});

// ---------- Update User Function ----------
exports.updateUser = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    try {
      const { editUserId, name, email, password, role, username } = req.body;
      if (!editUserId || !name || !email || !role || !username) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Prepare updated data
      const updatedData = { name, email, role };

      // If a new password is provided, hash it
      if (password) {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        updatedData.password = hashedPassword;
      }

      // Update user data in Realtime Database under "logins/editUserId"
      await admin.database().ref(`logins/${editUserId}`).update(updatedData);

      return res.status(200).json({ message: "User updated successfully" });
    } catch (error) {
      console.error("Error updating user:", error);
      return res
        .status(500)
        .json({ error: "Error updating user", details: error.message });
    }
  });
});

// ---------- Change Password Function ----------
exports.changePassword = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    try {
      const { userId, oldPassword, newPassword } = req.body;
      if (!userId || !oldPassword || !newPassword) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Retrieve current user data using the 'userId'
      const snapshot = await admin.database().ref(`logins/${userId}`).once("value");
      const user = snapshot.val();
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify the old password
      const passwordMatch = await bcrypt.compare(oldPassword, user.password);
      if (!passwordMatch) {
        return res.status(400).json({ error: "Old password is incorrect" });
      }

      // Check if the new password is different from the old one
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        return res.status(400).json({ error: "New password must be different from the old password." });
      }

      // Hash the new password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update the password in the database
      await admin.database().ref(`logins/${userId}`).update({ password: hashedPassword });

      return res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error updating password:", error);
      return res.status(500).json({ error: "Error updating password", details: error.message });
    }
  });
});

// ---------- Scheduled Class Attendance Check Function ----------
// This function runs every 5 minutes, checks for classes that have ended,
// and marks enrolled students as "absent" if no valid attendance log exists for today.
exports.checkClassAttendance = functions.pubsub
  .schedule("*/5 7-23 * * *")
  .timeZone("Asia/Manila")
  .onRun(async (context) => {
    const db = admin.database();

    // Convert current time to Manila time explicitly.
    const now = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
    );
    console.log(`Current Manila time: ${now}`);

    // Build a YYYY-MM-DD string based on Manila time.
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const today = `${year}-${month}-${day}`; // e.g., "2025-03-18"
    console.log(`Today (Manila): ${today}`);

    // Get today's weekday in full format (e.g., "Wednesday")
    const todayDay = now.toLocaleString("en-US", {
      weekday: "long",
      timeZone: "Asia/Manila",
    });
    console.log(`Today is: ${todayDay}`);

    try {
      // Get all classes
      const classesSnapshot = await db.ref("classes").once("value");
      const classes = classesSnapshot.val();
      if (!classes) {
        console.log("No classes found");
        return null;
      }

      // Get all user logins (students)
      const loginsSnapshot = await db.ref("logins").once("value");
      const logins = loginsSnapshot.val();
      if (!logins) {
        console.log("No logins found");
        return null;
      }

      // Process each class
      for (const classId in classes) {
        const classData = classes[classId];

        // Skip archived classes
        if (classData.archiveClass) {
          console.log(
            `Class ${classData.name} (ID: ${classId}) is archived. Skipping...`
          );
          continue;
        }

        // NEW: Skip if today's weekday is not included in the class's scheduled days.
        if (!classData.days || !classData.days.includes(todayDay)) {
          console.log(
            `Today is ${todayDay}, but class ${classData.name} meets on ${classData.days}. Skipping...`
          );
          continue;
        }

        if (!classData.time) continue;

        // Assume classData.time is in "HH:mm - HH:mm" format
        const timeParts = classData.time.split("-");
        if (timeParts.length !== 2) continue;

        const scheduledEndStr = timeParts[1].trim();

        // Helper: parse scheduled end time into a Date object (Manila time) for today.
        const parseTimeToToday = (timeStr) => {
          const [hourStr, minuteStr] = timeStr.split(":");
          return new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            parseInt(hourStr, 10),
            parseInt(minuteStr, 10)
          );
        };

        const classEndTime = parseTimeToToday(scheduledEndStr);
        console.log(
          `Class ${classData.name} (ID: ${classId}) scheduled end time: ${classEndTime}`
        );

        // If the class hasn't ended yet, skip to next class
        if (now < classEndTime) {
          console.log(`Class ${classData.name} hasn't ended yet. Skipping...`);
          continue;
        }

        // For every student enrolled in this class, check attendance logs for today
        for (const userId in logins) {
          const student = logins[userId];
          if (student.enrolledClasses && student.enrolledClasses[classId]) {
            const enrollment = student.enrolledClasses[classId];
            const attendanceLogs = enrollment.attendanceLogs || {};
            let attendedToday = false;
            let alreadyAbsent = false;

            for (const logId in attendanceLogs) {
              const log = attendanceLogs[logId];
              if (log.date === today) {
                // If they have a valid time_in or time_out, they attended
                if (log.time_in || log.time_out) {
                  attendedToday = true;
                  break;
                }
                // If there's already an "absent" log for today
                if (log.status === "absent") {
                  alreadyAbsent = true;
                }
              }
            }

            // If no attendance record and no absent log, push a new absent log
            if (!attendedToday && !alreadyAbsent) {
              console.log(
                `Pushing absent log for ${student.name} (User ID: ${userId}) in class ${classData.name}`
              );
              await db
                .ref(`logins/${userId}/enrolledClasses/${classId}/attendanceLogs`)
                .push({
                  date: today,
                  status: "absent",
                  time_in: "",
                  time_out: "",
                });
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in checkClassAttendance:", error);
    }
    return null;
  });


// ---------- Send Email Function ----------
exports.sendEmail = functions.https.onRequest((req, res) => {
  return cors(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }
    try {
      const { email, username, password } = req.body;
      if (!email || !username || !password) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Construct the email
      const msg = {
        to: email,
        from: "from your email", // Must be verified in SendGrid
        subject: "Your Account Credentials",
        text: `Hello,

Your account has been created.
Username: ${username}
Password: ${password}

Please change your password after logging in.
https://thesis1-d9ca1.web.app/`
      };

      // Send the email via SendGrid
      await sgMail.send(msg);
      return res.status(200).json({ message: "Email sent successfully" });
    } catch (error) {
      console.error("Email sending error:", error);
      return res
        .status(500)
        .json({ error: "Failed to send email", details: error.message });
    }
  });
});
exports.dailyAbsenceCheck = functions.pubsub
.schedule("59 23 * * *")
.timeZone("Asia/Manila")
.onRun(async (context) => {
const db = admin.database();
const today = new Date().toISOString().split("T")[0];
const nowManila = new Date(
new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
);
const todayDay = nowManila.toLocaleString("en-US", {
weekday: "long",
timeZone: "Asia/Manila",
});

// Helper: parse a time string into { hours, minutes }  
function parseTime(timeStr) {  
  if (  
    !timeStr ||  
    timeStr.trim() === "" ||  
    timeStr.trim() === "-" ||  
    timeStr.trim() === "/"  
  ) {  
    return { hours: 0, minutes: 0 };  
  }  
  const trimmed = timeStr.trim().toUpperCase();  
  const amPmMatch = trimmed.match(/(AM|PM)$/);  
  if (amPmMatch) {  
    const parts = trimmed.replace(/(AM|PM)/, "").trim().split(":");  
    let hh = parseInt(parts[0], 10) || 0;  
    const mm = parts[1] ? parseInt(parts[1], 10) || 0 : 0;  
    if (trimmed.includes("PM") && hh < 12) hh += 12;  
    else if (trimmed.includes("AM") && hh === 12) hh = 0;  
    return { hours: hh, minutes: mm };  
  } else {  
    const parts = trimmed.split(":");  
    return {  
      hours: parseInt(parts[0], 10) || 0,  
      minutes: parts[1] ? parseInt(parts[1], 10) || 0 : 0,  
    };  
  }  
}  

// Helper: checks if time_in is after scheduled start + 15 minutes  
function isLate(timeInStr, scheduledStart) {  
  const { hours: startH, minutes: startM } = parseTime(scheduledStart);  
  const scheduledStartTime = new Date(1970, 0, 1, startH, startM);  
  const thresholdTime = new Date(scheduledStartTime.getTime() + 15 * 60 * 1000);  
  const { hours, minutes } = parseTime(timeInStr);  
  const timeIn = new Date(1970, 0, 1, hours, minutes);  
  return timeIn > thresholdTime;  
}  

// Helper: checks if time_out is before scheduled end  
function isEarlyTimeout(timeOutStr, scheduledEnd) {  
  const { hours: endH, minutes: endM } = parseTime(scheduledEnd);  
  const scheduledEndTime = new Date(1970, 0, 1, endH, endM);  
  const { hours, minutes } = parseTime(timeOutStr);  
  const timeOut = new Date(1970, 0, 1, hours, minutes);  
  return timeOut < scheduledEndTime;  
}  

try {  
  // Fetch classes and logins  
  const classesSnapshot = await db.ref("classes").once("value");  
  const classes = classesSnapshot.val() || {};  
  const loginsSnapshot = await db.ref("logins").once("value");  
  const logins = loginsSnapshot.val() || {};  

  // Iterate over each class  
  for (const classId in classes) {  
    const classData = classes[classId];  

    // Skip archived classes.  
    if (classData.archiveClass) {  
      console.log(`Class ${classData.name} (ID: ${classId}) is archived. Skipping...`);  
      continue;  
    }  

    // Only proceed if today's day is in classData.days  
    if (!classData.days || !classData.days.includes(todayDay)) continue;  
    if (!classData.time) continue;  

    const timeParts = classData.time.split("-");  
    if (timeParts.length !== 2) continue;  
    const scheduledStart = timeParts[0].trim();  
    const scheduledEnd = timeParts[1].trim();  

    // For each user in logins  
    for (const userId in logins) {  
      const userData = logins[userId];  
      if (userData.enrolledClasses && userData.enrolledClasses[classId]) {  
        const enrollment = userData.enrolledClasses[classId];  
        const logs = enrollment.attendanceLogs  
          ? Object.values(enrollment.attendanceLogs)  
          : [];  

        let absent = 0;  
        let late = 0;  
        let early = 0;  

        // Process all logs (accumulated absences) instead of only today's logs  
        logs.forEach((log) => {  
          // If time_in is missing, count as absent  
          if (!log.time_in || log.time_in.trim() === "") {  
            absent++;  
          } else if (log.time_out && log.time_out.trim() !== "") {  
            // If time_out is early, count as early timeout  
            if (isEarlyTimeout(log.time_out, scheduledEnd)) {  
              early++;  
            } else if (isLate(log.time_in, scheduledStart)) {  
              // If time_in is beyond threshold, count as late  
              late++;  
            }  
          } else {  
            // If time_in exists but time_out is missing, count as absent  
            absent++;  
          }  
        });  

        // Extra absences for every 3 combined late+early  
        const extra = Math.floor((late + early) / 3);  
        const effectiveAbsences = absent + extra;  
        if (effectiveAbsences < 4) continue;  

        // Check notificationsSent  
        const notifRef = db.ref(`notificationsSent/${classId}/${userId}/${today}`);  
        const notifSnapshot = await notifRef.once("value");  
        const notifications = notifSnapshot.val() || {};  

        let emailType = null;  
        if (effectiveAbsences >= 8) {  
          if (notifications.failedAttendance) continue;  
          emailType = "failedAttendance";  
        } else {  
          // 4-7 => warning  
          if (notifications.warning && notifications.warning.includes(effectiveAbsences)) {  
            continue;  
          }  
          emailType = "warning";  
        }  

        // Construct the email  
        let subject = "";  
        let text = "";  
        if (emailType === "warning") {  
          subject = "Attendance Warning";  
          text = `Dear ${userData.name},  

This is a warning that your effective absence count for class "${classData.name}" is ${effectiveAbsences}.
You will receive further warnings on each additional absence (e.g., on the 5th, 6th, and 7th absence).
Once your effective absences reach 8, a failed attendance notification will be sent.

Regards,
Attendance System; } else if (emailType === "failedAttendance") { subject = "Failed Attendance Notification"; text = Dear Teacher,

Student ${userData.name} in class "${classData.name}" has reached an effective absence count of ${effectiveAbsences} and has failed attendance.
Please take the necessary actions.

Regards,
Attendance System`;
}

        // All emails go to the same address  
        const msg = {  
          to: "",  
          from: "",  
          subject,  
          text,  
        };  

        // Send the email  
        await sgMail.send(msg);  

        // Record the notification  
        if (emailType === "failedAttendance") {  
          await notifRef.update({ failedAttendance: true });  
        } else if (emailType === "warning") {  
          const warningArray = notifications.warning || [];  
          warningArray.push(effectiveAbsences);  
          await notifRef.update({ warning: warningArray });  
        }  

        console.log(  
          `Sent ${emailType} email for ${userData.name} in class "${classData.name}" (Effective Absences: ${effectiveAbsences})`  
        );  
      }  
    }  
  }  
  return null;  
} catch (error) {  
  console.error("Error in dailyAbsenceCheck:", error);  
  return null;  
}  

});

// ---------- Scheduled Reset Attendance Function ----------
// This function runs every midnight and resets each enrolled class's attendance flag to false.
exports.resetAttendance = functions.pubsub
  .schedule("0 0 * * *")
  .timeZone("Asia/Manila")
  .onRun(async (context) => {
    const db = admin.database();
    const usersRef = db.ref("logins");

    try {
      const snapshot = await usersRef.once("value");
      const users = snapshot.val();

      if (users) {
        for (const userId in users) {
          if (users[userId].enrolledClasses) {
            for (const classId in users[userId].enrolledClasses) {
              // Reset attendance to false
              await usersRef
                .child(`${userId}/enrolledClasses/${classId}/attendance`)
                .set(false);
            }
          }
        }
      }

      console.log("Attendance reset successfully.");
    } catch (error) {
      console.error("Error resetting attendance:", error);
    }

    return null;
  });
