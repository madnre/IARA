import React, { FC, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getApps, initializeApp } from "firebase/app";
import { getDatabase, ref, get, update, remove } from "firebase/database";
import * as XLSX from "xlsx";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DownloadIcon from "@mui/icons-material/Download";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

/* ----------------- Firebase Setup ----------------- */
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

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const database = getDatabase(app);

/* ----------------- Interfaces ----------------- */
interface AttendanceLogEntry {
  logKey: string;       // Firebase key for this log
  userKey: string;      // Firebase key for the student
  userName: string;
  date: string;
  time_in: string;
  time_out?: string;
  scanner_in?: string;
  scanner_out?: string;
  status: string;
  excused?: boolean;
}

interface StudentData {
  name: string;
  email: string;
  enrolledClasses?: Record<
    string,
    {
      attendance: boolean;
      attendanceLogs?: Record<
        string,
        {
          date: string;
          time_in: string;
          time_out?: string;
          scanner_in?: string;
          scanner_out?: string;
          excused?: boolean;
        }
      >;
    }
  >;
}

interface ClassData {
  name: string;
  time: string;
  days?: string[]; // e.g. ["Monday", "Wednesday", "Friday"]
}

interface ChartCounts {
  late: number;
  onTime: number;
  absent: number;
  early: number;
}

interface AttendanceClientProps {
  classId: string;
  role: "admin" | "teacher" | "student";
  currentUserName: string;
}

/* ----------------- CollapsibleRow ----------------- */
interface CollapsibleRowProps {
  row: AttendanceLogEntry;
  role: "admin" | "teacher" | "student";
  classId: string;
  index: number;
}


const CollapsibleRow: React.FC<CollapsibleRowProps> = ({ row, role, classId, index }) => {
  const [open, setOpen] = useState(false);
  const handleClick = () => setOpen(!open);

  const handleToggleExcuse = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const logRef = ref(
        database,
        `logins/${row.userKey}/enrolledClasses/${classId}/attendanceLogs/${row.logKey}`
      );
      await update(logRef, { excused: !row.excused });
      alert(`Record marked as ${!row.excused ? "Excused" : "Not Excused"}.`);
    } catch (error) {
      console.error("Error updating excused status:", error);
      alert("An error occurred while updating the status.");
    }
  };

  return (
    <>
      <TableRow onClick={handleClick} style={{ cursor: "pointer" }}>
        <TableCell>{index}</TableCell>
        <TableCell>{row.userName}</TableCell>
        <TableCell>{row.date}</TableCell>
        <TableCell>
          {row.excused ? (
            <Typography sx={{ color: "green", fontWeight: 600 }}>
              Excused
            </Typography>
          ) : (
            row.status
          )}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={4} sx={{ p: 2, backgroundColor: "#f9f9f9" }}>
            <Typography variant="body2">
              <strong>Time In:</strong> {row.time_in}
            </Typography>
            <Typography variant="body2">
              <strong>Time Out:</strong> {row.time_out || "-"}
            </Typography>
            <Typography variant="body2">
              <strong>Scanner In:</strong> {row.scanner_in || "N/A"}
            </Typography>
            <Typography variant="body2">
              <strong>Scanner Out:</strong> {row.scanner_out || "N/A"}
            </Typography>
            {(role === "teacher" || role === "admin") && false && (
              <Button
                variant="contained"
                color={row.excused ? "warning" : "success"}
                sx={{ mt: 1 }}
                onClick={handleToggleExcuse}
              >
                {row.excused ? "Remove Excuse" : "Mark as Excused"}
              </Button>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

/* ----------------- CollapsibleAbsenceRow ----------------- */
interface AbsenceTally {
  absent: number;
  late: number;
  early: number;
  effective: number;
}

interface CollapsibleAbsenceRowProps {
  name: string;
  tally: AbsenceTally;
}

const CollapsibleAbsenceRow: React.FC<CollapsibleAbsenceRowProps> = ({
  name,
  tally,
}) => {
  const [open, setOpen] = useState(false);
  const handleClick = () => setOpen(!open);

  let summaryStyle: React.CSSProperties = {};
  let faFlag = "";

  if (tally.effective >= 8) {
    summaryStyle = { backgroundColor: "#ffcccc" };
    faFlag = "Failed Attendance";
  } else if (tally.effective >= 4) {
    summaryStyle = { backgroundColor: "#ffe0b3" };
    faFlag = "Half FA";
  }

  return (
    <>
      <TableRow onClick={handleClick} style={{ cursor: "pointer", ...summaryStyle }}>
        <TableCell>{name}</TableCell>
        <TableCell align="right">{tally.effective}</TableCell>
        <TableCell align="center">{faFlag}</TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={3} sx={{ p: 2, backgroundColor: "#f9f9f9" }}>
            <Typography variant="body2">
              <strong>Actual Absences:</strong> {tally.absent}
            </Typography>
            <Typography variant="body2">
              <strong>Late Count:</strong> {tally.late}
            </Typography>
            <Typography variant="body2">
              <strong>Early Timeout Count:</strong> {tally.early}
            </Typography>
            <Typography variant="body2">
              <strong>Extra Absences (from late/early):</strong>{" "}
              {Math.floor((tally.late + tally.early) / 3)}
            </Typography>
          </TableCell>
        </TableRow>
      )}
    </>
  );
};

/* ----------------- HorizontalSlimBar ----------------- */
const HorizontalSlimBar: React.FC<{ chartCounts: ChartCounts }> = ({ chartCounts }) => {
  const { late, onTime, absent, early } = chartCounts;
  const total = late + onTime + absent + early || 1;
  const segments = [
    { label: "Late", value: late, color: "#FAC898" },
    { label: "On Time", value: onTime, color: "#77DD77" },
    { label: "Absent", value: absent, color: "#FF6961" },
  ];
  const [showBreakdown, setShowBreakdown] = useState(false);

  return (
    <Box sx={{ width: "100%", mt: 1 }}>
      <Box
        sx={{
          display: "flex",
          width: "100%",
          height: 20,
          borderRadius: 1,
          overflow: "hidden",
          boxShadow: 1,
          cursor: "pointer",
        }}
        onClick={() => setShowBreakdown(!showBreakdown)}
      >
        {segments.map((seg, idx) => {
          if (seg.value === 0) return null;
          const widthPercent = (seg.value / total) * 100;
          return (
            <Box key={idx} sx={{ width: `${widthPercent}%`, backgroundColor: seg.color }} />
          );
        })}
      </Box>
      {showBreakdown && (
        <Box sx={{ mt: 1, px: 1, py: 0.5, border: "1px solid #ccc", borderRadius: 1 }}>
          {segments.map((seg, idx) => (
            <Typography key={idx} variant="caption" display="block">
              {seg.label}: {seg.value}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
};

/* ----------------- AttendanceClient Component ----------------- */
const AttendanceClient: FC<AttendanceClientProps> = ({ classId, role, currentUserName }) => {
  const [classData, setClassData] = useState<ClassData | null>(null);
  const [attendanceData, setAttendanceData] = useState<AttendanceLogEntry[]>([]);
  const [chartCounts, setChartCounts] = useState<ChartCounts>({ late: 0, onTime: 0, absent: 0, early: 0 });
  const [loading, setLoading] = useState<boolean>(true);
  const [searchName, setSearchName] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" })
  );
  const [excludeStartDate, setExcludeStartDate] = useState<string>("");
  const [excludeEndDate, setExcludeEndDate] = useState<string>("");
  const [showList, setShowList] = useState<boolean>(false);
  const [showAbsenceTally, setShowAbsenceTally] = useState<boolean>(false);
  const [showExcludeLogs, setShowExcludeLogs] = useState<boolean>(false);

  const router = useRouter();

  /* --------- Identify if today is a scheduled day --------- */
  const todayDay = new Date().toLocaleString("en-US", { weekday: "long" });
  const isClassScheduledToday = classData?.days?.includes(todayDay) || false;

  // Parse time strings
  const parseTime = useCallback((timeStr: string) => {
    if (!timeStr || timeStr.trim() === "-" || timeStr.trim() === "/") {
      return { hours: 0, minutes: 0 };
    }
    const trimmed = timeStr.trim().toUpperCase();
    const amPmMatch = trimmed.match(/(AM|PM)$/);
    if (amPmMatch) {
      const [hhStr, mmStr] = trimmed.replace(/(AM|PM)/, "").trim().split(":");
      let hh = parseInt(hhStr, 10) || 0;
      const mm = mmStr ? parseInt(mmStr, 10) || 0 : 0;
      if (trimmed.includes("PM") && hh < 12) {
        hh += 12;
      } else if (trimmed.includes("AM") && hh === 12) {
        hh = 0;
      }
      return { hours: hh, minutes: mm };
    } else {
      const [hhStr, mmStr] = trimmed.split(":");
      const hh = parseInt(hhStr, 10) || 0;
      const mm = mmStr ? parseInt(mmStr, 10) || 0 : 0;
      return { hours: hh, minutes: mm };
    }
  }, []);
  const getLogSortValue = useCallback(
    (log: AttendanceLogEntry): { rank: number; time: number } => {
      const [year, month, day] = log.date.split("-").map(Number);
  
      // If no time_in, treat as absent (lowest rank)
      if (!log.time_in || log.time_in.trim() === "") {
        return { rank: 0, time: 0 };
      }
  
      // Default: has time_in only, rank 1.
      let rank = 1;
      // Use time_in value
      const { hours: inHours, minutes: inMinutes } = parseTime(log.time_in);
      let timeValue = new Date(year, month - 1, day, inHours, inMinutes).getTime();
  
      // If there's a time_out (i.e. time in and time out), upgrade rank and use the time_out value
      if (log.time_out && log.time_out.trim() !== "") {
        rank = 2;
        const { hours: outHours, minutes: outMinutes } = parseTime(log.time_out);
        timeValue = new Date(year, month - 1, day, outHours, outMinutes).getTime();
      }
      return { rank, time: timeValue };
    },
    [parseTime]
  );
  const parseTimeoutDateTime = useCallback(
    (log: AttendanceLogEntry): Date => {
      const [year, month, day] = log.date.split("-").map(Number);
      if (log.time_out && log.time_out.trim() !== "") {
        const { hours, minutes } = parseTime(log.time_out);
        return new Date(year, month - 1, day, hours, minutes);
      } else {
        // Fallback to time_in if time_out is missing
        const { hours, minutes } = parseTime(log.time_in);
        return new Date(year, month - 1, day, hours, minutes);
      }
    },
    [parseTime]
  );
  const parseDateTime = useCallback(
    (log: AttendanceLogEntry): Date => {
      const [year, month, day] = log.date.split("-").map(Number);
      const { hours, minutes } = parseTime(log.time_in);
      return new Date(year, month - 1, day, hours, minutes);
    },
    [parseTime]
  );

  // For determining "Late"
  const isLate = useCallback(
    (attendanceTimeStr: string): boolean => {
      if (!classData || !classData.time) return false;
      const scheduledStart = classData.time.split("-")[0].trim();
      const { hours: startH, minutes: startM } = parseTime(scheduledStart);
      const classStartTime = new Date(1970, 0, 1, startH, startM);
      // 15-minute grace period
      const thresholdTime = new Date(classStartTime.getTime() + 15 * 60 * 1000);
      const { hours, minutes } = parseTime(attendanceTimeStr);
      const attendanceTime = new Date(1970, 0, 1, hours, minutes);
      return attendanceTime > thresholdTime;
    },
    [classData, parseTime]
  );

  // Compute absence tally disregarding excused logs
  const absenceTally = useMemo(() => {
    const tally: Record<string, AbsenceTally> = {};
    attendanceData.forEach((log) => {
      // Skip records that are excused
      if (log.excused) return;
      if (!tally[log.userName]) {
        tally[log.userName] = { absent: 0, late: 0, early: 0, effective: 0 };
      }
      if (log.status === "Absent") {
        tally[log.userName].absent++;
      } else if (log.status === "Late") {
        tally[log.userName].late++;
      } else if (log.status === "Early Timeout") {
        tally[log.userName].early++;
      }
    });
    Object.keys(tally).forEach((name) => {
      const { absent, late, early } = tally[name];
      const extra = Math.floor((late + early) / 3);
      tally[name].effective = absent + extra;
    });
    return tally;
  }, [attendanceData]);

  // Fetch class data
  useEffect(() => {
    if (!classId) return;
    const fetchClassData = async () => {
      const classRef = ref(database, `classes/${classId}`);
      try {
        const snapshot = await get(classRef);
        if (snapshot.exists()) {
          setClassData(snapshot.val());
        } else {
          setClassData({ name: "Unknown Class", time: "09:00 - 10:00" });
        }
      } catch (error) {
        console.error("Error fetching class data:", error);
        setClassData({ name: "Error Loading Class", time: "09:00 - 10:00" });
      }
    };
    fetchClassData();
  }, [classId]);

  // Fetch attendance logs (for "today" by default)
  useEffect(() => {
    if (!classId) return;

    const today = new Date().toISOString().split("T")[0]; // e.g. "2025-03-12"
    const fetchAttendanceLogs = async () => {
      setLoading(true);
      try {
        const dbRef = ref(database, "logins");
        const snapshot = await get(dbRef);
        if (snapshot.exists()) {
          const data: Record<string, StudentData> = snapshot.val();
          const logs: AttendanceLogEntry[] = [];

          let lateCount = 0;
          let onTimeCount = 0;
          let absentCount = 0;
          const earlyCount = 0;
          let totalLogsForToday = 0;
          const today = new Date().toISOString().split("T")[0];

          Object.entries(data).forEach(([userKey, studentInfo]) => {
            // If role=student, only look at the current student's logs
            if (role === "student" && studentInfo.name !== currentUserName) return;

            const enrollment = studentInfo.enrolledClasses?.[classId];
            if (!enrollment) return;

            const attendanceLogs = enrollment.attendanceLogs || {};

            Object.entries(attendanceLogs).forEach(([logKey, logObj]: [string, any]) => {
              let status = "Absent";
              if (logObj.time_in) {
                if (logObj.time_out) {
                  const scheduledTimes = classData?.time.split("-");
                  const scheduledEnd = scheduledTimes?.[1]?.trim() || "10:00";
                  const { hours: endH, minutes: endM } = parseTime(scheduledEnd);
                  const classEndTime = new Date(1970, 0, 1, endH, endM);
            
                  const { hours: outH, minutes: outM } = parseTime(logObj.time_out);
                  const logTimeOut = new Date(1970, 0, 1, outH, outM);
            
                  // Define a 10-minute margin
                  const marginMs = 10 * 60 * 1000;
                  if (classEndTime.getTime() - logTimeOut.getTime() > marginMs) {
                    status = "Early Timeout";
                  } else {
                    status = isLate(logObj.time_in) ? "Late" : "Present";
                  }
                } else {
                  status = "Absent";
                }
              }
            
              logs.push({
                logKey,
                userKey,
                // Add a fallback here:
                userName: studentInfo.name || "Unknown User",
                date: logObj.date,
                time_in: logObj.time_in || "",
                time_out: logObj.time_out || "",
                scanner_in: logObj.scanner_in || "N/A",
                scanner_out: logObj.scanner_out || "N/A",
                status,
                excused: logObj.excused || false,
              });
            });

            // Process today's logs for the chart summary
            const todaysLogsForStudent = Object.values(attendanceLogs).filter(
              (log: any) => log.date === today && !log.excused
            );
            if (todaysLogsForStudent.length > 0) {
              totalLogsForToday += todaysLogsForStudent.length;
              const scheduledTimes = classData?.time.split("-");
              const scheduledEnd = scheduledTimes?.[1]?.trim() || "10:00";
              const { hours: endH, minutes: endM } = parseTime(scheduledEnd);
              const classEndTime = new Date(1970, 0, 1, endH, endM);

              // Apply a 10-minute margin: logs with time_out within 10 minutes before classEndTime are valid.
              const marginMs = 10 * 60 * 1000;
              const validLogs = todaysLogsForStudent.filter((log: any) => {
                if (!log.time_out) return false;
                const { hours, minutes } = parseTime(log.time_out);
                const logTimeOut = new Date(1970, 0, 1, hours, minutes);
                return logTimeOut.getTime() >= classEndTime.getTime() - marginMs;
              });

              if (validLogs.length > 0) {
                validLogs.sort(
                  (a: any, b: any) =>
                    new Date(1970, 0, 1, parseTime(a.time_in).hours, parseTime(a.time_in).minutes).getTime() -
                    new Date(1970, 0, 1, parseTime(b.time_in).hours, parseTime(b.time_in).minutes).getTime()
                );
                const earliestLog = validLogs[0];
                if (isLate(earliestLog.time_in)) {
                  lateCount++;
                } else {
                  onTimeCount++;
                }
              } else {
                absentCount++;
              }
            }
          });

          setChartCounts({
            late: lateCount,
            onTime: onTimeCount,
            absent: absentCount,
            early: earlyCount,
          });

          logs.sort((a, b) => {
            const aVal = getLogSortValue(a);
            const bVal = getLogSortValue(b);
            // Higher rank comes first.
            if (bVal.rank !== aVal.rank) {
              return bVal.rank - aVal.rank;
            }
            // If ranks are the same, sort by time descending (most recent first)
            return bVal.time - aVal.time;
          });
          setAttendanceData(logs);
        }
      } catch (error) {
        console.error("Error fetching attendance logs:", error);
      }
      setLoading(false);
    };

    fetchAttendanceLogs();
  }, [
    classId,
    classData,
    parseDateTime,
    parseTime,
    isLate,
    role,
    currentUserName,
    isClassScheduledToday,
  ]);

  // Filter logs for the table
  const filteredData = attendanceData.filter((log) => {
    // Filter by name (if teacher/admin)
    const matchesName = log.userName.toLowerCase().includes(searchName.toLowerCase());
    // Filter by date
    const matchesDate = filterDate === "" || log.date === filterDate;
    return matchesName && matchesDate;
  });

  // Export logs to Excel
  const exportToExcel = () => {
    const dataToExport = filteredData.map((log) => ({
      Name: log.userName,
      Date: log.date,
      "Time In": log.time_in,
      "Time Out": log.time_out || "-",
      "Scanner In": log.scanner_in || "N/A",
      "Scanner Out": log.scanner_out || "N/A",
      Status: log.excused ? "Excused" : log.status,
    }));
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Logs");
    XLSX.writeFile(workbook, `Attendance_${classData?.name || classId}.xlsx`);
  };

  // Exclude logs within a date range
  const excludeLogsForRange = async (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return;
    try {
      const dbRef = ref(database, "logins");
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        const data: Record<string, StudentData> = snapshot.val();
        const startTs = new Date(startDate).getTime();
        const endTs = new Date(endDate).getTime();
        for (const [userKey, studentInfo] of Object.entries(data)) {
          const enrolled = studentInfo.enrolledClasses?.[classId];
          if (enrolled && enrolled.attendanceLogs) {
            for (const [logKey, log] of Object.entries(enrolled.attendanceLogs)) {
              const logTs = new Date(log.date).getTime();
              if (logTs >= startTs && logTs <= endTs) {
                await remove(
                  ref(database, `logins/${userKey}/enrolledClasses/${classId}/attendanceLogs/${logKey}`)
                );
              }
            }
          }
        }
        alert(`Logs from ${startDate} to ${endDate} have been excluded.`);
        setTimeout(() => window.location.reload(), 1000);
      } else {
        alert("No attendance data found.");
      }
    } catch (error) {
      console.error("Error excluding logs:", error);
      alert("An error occurred while excluding logs.");
    }
  };

  // Compute if there are any logs for "today" specifically
  const todayStr = new Date().toISOString().split("T")[0];
  const logsForToday = attendanceData.filter((log) => log.date === todayStr);
  const anyLogsForToday = logsForToday.length > 0;

  return (
    <Box sx={{ backgroundColor: "#f3f4f6", minHeight: "100vh", p: 2 }}>
      {/* Back Button */}
      <Box sx={{ position: "fixed", top: 16, left: 16, zIndex: 1000 }}>
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

      <Grid container spacing={2} sx={{ mt: 4 }}>
        {/* Attendance Summary */}
        <Grid item xs={12} md={6} lg={4}>
          <Paper sx={{ p: 1, display: "flex", flexDirection: "column", minHeight: 120 }}>
            <Typography variant="subtitle1" textAlign="center" sx={{ mb: 1 }}>
              {classData?.name || "Class"} Attendance Summary
            </Typography>

            {/* 1. If NOT a scheduled day, show a message */}
            {!isClassScheduledToday ? (
              <Typography textAlign="center" color="text.secondary">
                No schedule today.
              </Typography>
            ) : (
              // 2. If it IS scheduled but no logs, show a gray bar or message
              !anyLogsForToday ? (
                <Box sx={{ textAlign: "center" }}>
                  <Typography variant="body2">No logs yet for today.</Typography>
                  {/* Gray bar */}
                  <Box
                    sx={{
                      width: "100%",
                      height: 20,
                      backgroundColor: "#ccc",
                      borderRadius: 1,
                      mt: 1,
                    }}
                  />
                </Box>
              ) : (
                // 3. If there ARE logs for today, show the usual bar
                <HorizontalSlimBar chartCounts={chartCounts} />
              )
            )}
          </Paper>
        </Grid>

        {/* Controls */}
        <Grid item xs={12} md={6} lg={8}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Controls
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Button variant="contained" onClick={() => setShowList(!showList)} fullWidth>
                  {showList ? "Hide Attendance Logs" : "Show Attendance Logs"}
                </Button>
              </Grid>
              {role !== "student" && (
                <>
                  <Grid item xs={12} sm={4}>
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={() => setShowAbsenceTally(!showAbsenceTally)}
                      fullWidth
                    >
                      {showAbsenceTally ? "Hide Absence Tally" : "Show Absence Tally"}
                    </Button>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Button
                      variant="contained"
                      color="info"
                      onClick={() => setShowExcludeLogs(!showExcludeLogs)}
                      fullWidth
                    >
                      {showExcludeLogs ? "Hide Exclude Logs" : "Show Exclude Logs"}
                    </Button>
                  </Grid>
                </>
              )}
            </Grid>
          </Paper>

          {role !== "student" && showExcludeLogs && (
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" gutterBottom>
                Exclude Logs (for Holidays/Suspensions)
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    type="date"
                    label="Start Date"
                    variant="outlined"
                    value={excludeStartDate}
                    onChange={(e) => setExcludeStartDate(e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    type="date"
                    label="End Date"
                    variant="outlined"
                    value={excludeEndDate}
                    onChange={(e) => setExcludeEndDate(e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    onClick={() => {
                      if (
                        window.confirm(
                          `Are you sure you want to exclude logs from ${excludeStartDate} to ${excludeEndDate}?`
                        )
                      ) {
                        excludeLogsForRange(excludeStartDate, excludeEndDate);
                      }
                    }}
                  >
                    Exclude Logs
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          )}
        </Grid>

        {/* Attendance Logs Table */}
        {showList && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Grid container alignItems="center" justifyContent="space-between">
                <Grid item>
                  <Typography variant="h6">Attendance Logs</Typography>
                </Grid>
                <Grid item>
                  <Button
                    variant="contained"
                    onClick={exportToExcel}
                    sx={{
                      backgroundColor: "#4caf50",
                      color: "white",
                      "&:hover": { backgroundColor: "#388e3c" },
                      minWidth: 40,
                      minHeight: 40,
                      p: 0,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <DownloadIcon />
                  </Button>
                </Grid>
              </Grid>
              <Grid container spacing={2} sx={{ mt: 2, mb: 2 }}>
                {role !== "student" && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      type="text"
                      label="Search by Name"
                      variant="outlined"
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      fullWidth
                    />
                  </Grid>
                )}
                <Grid item xs={12} sm={role !== "student" ? 6 : 12}>
                  <TextField
                    type="date"
                    label="Filter by Date"
                    variant="outlined"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              </Grid>
              {filteredData.length === 0 ? (
                <Typography textAlign="center" color="text.secondary">
                  No matching attendance records found.
                </Typography>
              ) : (
                <TableContainer>
                  <Table aria-label="attendance table" size="small">
                  <TableHead>
  <TableRow>
    <TableCell>#</TableCell>
    <TableCell>Name</TableCell>
    <TableCell>Date</TableCell>
    <TableCell>Status</TableCell>
  </TableRow>
</TableHead>
<TableBody>
  {filteredData.map((log, index) => (
    <CollapsibleRow
      key={log.logKey || index}
      row={log}
      role={role}
      classId={classId}
      index={index + 1} // pass the index (starting at 1)
    />
  ))}
</TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        )}

        {/* Absence Tally */}
        {role !== "student" && showAbsenceTally && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" mb={2}>
                Absence Tally (Excused records are disregarded)
              </Typography>
              {Object.keys(absenceTally).length === 0 ? (
                <Typography textAlign="center" color="text.secondary">
                  No absence records available.
                </Typography>
              ) : (
                <TableContainer>
                  <Table aria-label="absence tally table" size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell align="right">Effective Absences</TableCell>
                        <TableCell align="center">FA</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(absenceTally)
                        .sort(([, a], [, b]) => b.effective - a.effective)
                        .map(([name, tally]) => (
                          <CollapsibleAbsenceRow key={name} name={name} tally={tally} />
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default AttendanceClient;
