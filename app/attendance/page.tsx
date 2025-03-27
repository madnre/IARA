"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AttendanceClient from "./AttendanceClient";

// Mark this page as dynamic so that Next.js doesn't try to pre-render it.
export const dynamic = "force-dynamic";

const AttendancePage = () => {
  const searchParams = useSearchParams();
  const queryClassId = searchParams.get("classId");

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [userData, setUserData] = useState<{ name: string; role: "admin" | "teacher" | "student" } | null>(null);

  useEffect(() => {
    if (queryClassId) {
      setSelectedClassId(queryClassId);
    }
    // Retrieve user data from localStorage
    const storedUserData = localStorage.getItem("userData");
    if (storedUserData) {
      setUserData(JSON.parse(storedUserData));
    }
  }, [queryClassId]);

  if (!selectedClassId) {
    return (
      <div style={{ textAlign: "center", color: "#757575", padding: "20px" }}>
        No class selected.
      </div>
    );
  }

  if (!userData) {
    return (
      <div style={{ textAlign: "center", color: "#757575", padding: "20px" }}>
        Loading user data...
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#f3f4f6",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          padding: "20px",
          backgroundColor: "#ffffff",
          borderRadius: "10px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <AttendanceClient
          classId={selectedClassId}
          role={userData.role}
          currentUserName={userData.name}
        />
      </div>
    </div>
  );
};

const AttendancePageWithSuspense = () => {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: "20px" }}>Loading...</div>}>
      <AttendancePage />
    </Suspense>
  );
};

export default AttendancePageWithSuspense;
