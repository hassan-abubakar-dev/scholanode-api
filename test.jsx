import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  History,
  Info,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserRound,
  Users,
  UserX,
  X,
} from "lucide-react";
import { useUserContext } from "../../context/UserContext";

const SCAN_STORAGE_KEY = "scholanode:gate-scan-records";
const STUDENT_STORAGE_KEY = "scholanode:gate-scan-students";

const getLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getLocalDateTime = (minutesAgo = 0) => {
  return new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const createDemoStudents = () => [
  {
    id: "STU001",
    admissionNumber: "SN/2026/001",
    firstName: "Amina",
    surName: "Yusuf",
    className: "Primary 5A",
    gender: "Female",
    parentName: "Musa Yusuf",
    parentPhone: "0803 000 0001",
  },
  {
    id: "STU002",
    admissionNumber: "SN/2026/002",
    firstName: "Ibrahim",
    surName: "Musa",
    className: "Primary 5A",
    gender: "Male",
    parentName: "Fatima Musa",
    parentPhone: "0803 000 0002",
  },
  {
    id: "STU003",
    admissionNumber: "SN/2026/003",
    firstName: "Fatima",
    surName: "Abdullahi",
    className: "Primary 5A",
    gender: "Female",
    parentName: "Abdullahi Bello",
    parentPhone: "0803 000 0003",
  },
  {
    id: "STU004",
    admissionNumber: "SN/2026/004",
    firstName: "Yusuf",
    surName: "Bello",
    className: "Primary 4B",
    gender: "Male",
    parentName: "Aisha Bello",
    parentPhone: "0803 000 0004",
  },
  {
    id: "STU005",
    admissionNumber: "SN/2026/005",
    firstName: "Maryam",
    surName: "Sani",
    className: "Primary 4B",
    gender: "Female",
    parentName: "Sani Ibrahim",
    parentPhone: "0803 000 0005",
  },
  {
    id: "STU006",
    admissionNumber: "SN/2026/006",
    firstName: "Usman",
    surName: "Garba",
    className: "Primary 3A",
    gender: "Male",
    parentName: "Garba Usman",
    parentPhone: "0803 000 0006",
  },
  {
    id: "STU007",
    admissionNumber: "SN/2026/007",
    firstName: "Zainab",
    surName: "Ahmed",
    className: "Primary 5A",
    gender: "Female",
    parentName: "Ahmed Sani",
    parentPhone: "0803 000 0007",
  },
  {
    id: "STU008",
    admissionNumber: "SN/2026/008",
    firstName: "Abdullahi",
    surName: "Isah",
    className: "Primary 2A",
    gender: "Male",
    parentName: "Isah Abdullahi",
    parentPhone: "0803 000 0008",
  },
  {
    id: "STU009",
    admissionNumber: "SN/2026/009",
    firstName: "Hauwa",
    surName: "Suleiman",
    className: "Primary 5A",
    gender: "Female",
    parentName: "Suleiman Musa",
    parentPhone: "0803 000 0009",
  },
  {
    id: "STU010",
    admissionNumber: "SN/2026/010",
    firstName: "Mustapha",
    surName: "Lawal",
    className: "Primary 1A",
    gender: "Male",
    parentName: "Lawal Ibrahim",
    parentPhone: "0803 000 0010",
  },
];

const createDemoScans = (studentsList) => {
  const demoEntries = [
    { studentId: "STU001", minutesAgo: 8, status: "SUCCESS", method: "QR" },
    { studentId: "STU002", minutesAgo: 14, status: "SUCCESS", method: "MANUAL" },
    { studentId: "STU003", minutesAgo: 22, status: "DUPLICATE", method: "QR" },
    { studentId: "STU004", minutesAgo: 31, status: "SUCCESS", method: "QR" },
    { studentId: "STU005", minutesAgo: 42, status: "NEEDS_REVIEW", method: "MANUAL" },
    { studentId: "STU006", minutesAgo: 55, status: "SUCCESS", method: "QR" },
  ];

  return demoEntries.map((entry, index) => {
    const student = studentsList.find((item) => item.id === entry.studentId);
    return {
      id: `DEMO-SCAN-${index + 1}`,
      studentId: student?.id || entry.studentId,
      admissionNumber: student?.admissionNumber || `SN/2026/00${index + 1}`,
      studentName: student ? `${student.firstName} ${student.surName}` : "Sample Student",
      className: student?.className || "Primary 5A",
      date: getLocalDate(),
      scannedAt: getLocalDateTime(entry.minutesAgo),
      status: entry.status,
      method: entry.method,
      scannerName: "Gate Security Officer",
      message:
        entry.status === "DUPLICATE"
          ? "This student has already been scanned today."
          : entry.status === "NEEDS_REVIEW"
          ? "Manual admission number lookup required supervisor verification."
          : "Student arrival recorded successfully.",
      parentNotification: entry.status === "SUCCESS" ? "SIMULATED" : "NOT_SENT",
    };
  });
};

const readStorage = (key, fallback) => {
  try {
    const value = window.localStorage.getItem(key);
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const getInitialStudents = () => {
  const saved = readStorage(STUDENT_STORAGE_KEY, null);
  if (Array.isArray(saved) && saved.length > 0) return saved;
  const students = createDemoStudents();
  writeStorage(STUDENT_STORAGE_KEY, students);
  return students;
};

const getInitialScans = () => {
  const saved = readStorage(SCAN_STORAGE_KEY, null);
  if (Array.isArray(saved)) return saved;
  const students = getInitialStudents();
  const scans = createDemoScans(students);
  writeStorage(SCAN_STORAGE_KEY, scans);
  return scans;
};

const statusConfig = {
  SUCCESS: {
    label: "Successful",
    icon: CheckCircle2,
    badgeClass: "bg-emerald-50 text-emerald-700 ring-emerald-200/60",
  },
  DUPLICATE: {
    label: "Duplicate",
    icon: AlertCircle,
    badgeClass: "bg-amber-50 text-amber-700 ring-amber-200/60",
  },
  NEEDS_REVIEW: {
    label: "Needs review",
    icon: ShieldAlert,
    badgeClass: "bg-orange-50 text-orange-700 ring-orange-200/60",
  },
  FAILED: {
    label: "Failed",
    icon: UserX,
    badgeClass: "bg-rose-50 text-rose-700 ring-rose-200/60",
  },
};

function StatusBadge({ status }) {
  const config = statusConfig[status] || {
    label: status || "Unknown",
    icon: Info,
    badgeClass: "bg-slate-100 text-slate-600 ring-slate-200",
  };
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${config.badgeClass}`}
    >
      <Icon size={13} />
      {config.label}
    </span>
  );
}

function MethodBadge({ method }) {
  const isQr = method === "QR" || method === "QR Scan";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
      {isQr ? <QrCode size={13} className="text-[#123A8F]" /> : <UserRound size={13} className="text-cyan-700" />}
      {isQr ? "QR Code" : "Manual Lookup"}
    </span>
  );
}

function SummaryCard({ title, value, description, icon: Icon, tone = "blue" }) {
  const styles = {
    blue: {
      stripe: "from-blue-500 to-cyan-400",
      iconWrap: "bg-blue-50 text-[#123A8F] ring-blue-100",
    },
    green: {
      stripe: "from-emerald-500 to-teal-400",
      iconWrap: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    },
    amber: {
      stripe: "from-amber-500 to-yellow-400",
      iconWrap: "bg-amber-50 text-amber-700 ring-amber-100",
    },
    rose: {
      stripe: "from-rose-500 to-orange-400",
      iconWrap: "bg-rose-50 text-rose-700 ring-rose-100",
    },
  };

  const current = styles[tone] || styles.blue;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${current.stripe}`} />
      <div className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-[#071A52]">{value}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        <div className={`rounded-xl p-3 ring-1 ring-inset ${current.iconWrap}`}>
          <Icon size={21} />
        </div>
      </div>
    </div>
  );
}

function Avatar({ name = "" }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100/70 text-xs font-bold text-[#071A52]">
      {initials || "ST"}
    </div>
  );
}

function ScanDetailsModal({ record, onClose }) {
  if (!record) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-details-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
              <History size={15} />
              Gate Scan Record
            </div>
            <h2 id="scan-details-title" className="mt-1 text-xl font-extrabold text-[#071A52]">
              {record.studentName || "Unknown Student"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">{record.admissionNumber || "No admission number"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X size={19} />
          </button>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Scan Status</p>
              <div className="mt-1.5">
                <StatusBadge status={record.status} />
              </div>
            </div>
            <MethodBadge method={record.method} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3.5">
              <p className="text-xs text-slate-400">Class</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{record.className || "—"}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5">
              <p className="text-xs text-slate-400">Scan Date</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{formatDate(record.date)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5">
              <p className="text-xs text-slate-400">Scan Time</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{formatTime(record.scannedAt)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3.5">
              <p className="text-xs text-slate-400">Scanner Identity</p>
              <p className="mt-1 text-sm font-semibold text-slate-800">{record.scannerName || "Gate Security"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Result Message</p>
            <p className="mt-1.5 text-sm leading-6 text-slate-700">{record.message || "Arrival logged successfully."}</p>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#071A52]">
              <Info size={16} className="text-[#123A8F]" />
              Parent Arrival Notification
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              {record.parentNotification === "SIMULATED"
                ? "Simulated dispatch: In production, SMS/Email is sent immediately to the registered guardian."
                : "No automated notification triggered for this scan."}
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 p-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#071A52] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#123A8F]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SecurityDashboard() {
  const navigate = useNavigate();
  const { user, school } = useUserContext();

  const [students, setStudents] = useState(getInitialStudents);
  const [scanRecords, setScanRecords] = useState(getInitialScans);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [selectedRecord, setSelectedRecord] = useState(null);

  const today = getLocalDate();

  const officerName = useMemo(() => {
    if (user?.firstName || user?.surName) {
      return `${user.firstName || ""} ${user.surName || ""}`.trim();
    }
    if (user?.fullName || user?.name) {
      return user.fullName || user.name;
    }
    return user?.username || "Security Officer";
  }, [user]);

  const officerLoginId = user?.loginId || "SEC-001";
  const schoolName = school?.schoolName || "FEDERAL UNIVERSITY DUTSE";
  const schoolCode = school?.schoolCode || "FUD";
  const officerStatus = user?.status || "ACTIVE";

  const todayRecords = useMemo(
    () => scanRecords.filter((record) => record.date === today),
    [scanRecords, today]
  );

  const successfulRecords = useMemo(
    () => todayRecords.filter((record) => record.status === "SUCCESS"),
    [todayRecords]
  );

  const duplicateRecords = useMemo(
    () => todayRecords.filter((record) => record.status === "DUPLICATE"),
    [todayRecords]
  );

  const reviewOrFailedRecords = useMemo(
    () => todayRecords.filter((record) => record.status === "NEEDS_REVIEW" || record.status === "FAILED"),
    [todayRecords]
  );

  const uniqueScannedStudentIds = useMemo(
    () => new Set(successfulRecords.map((r) => r.studentId).filter(Boolean)),
    [successfulRecords]
  );

  const pendingStudentsCount = Math.max(0, students.length - uniqueScannedStudentIds.size);

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return [...scanRecords]
      .filter((record) => {
        if (statusFilter !== "ALL" && record.status !== statusFilter) return false;
        if (methodFilter !== "ALL" && record.method !== methodFilter) return false;

        if (query) {
          const matchString = `${record.studentName} ${record.admissionNumber} ${record.className} ${record.scannerName} ${record.message}`.toLowerCase();
          if (!matchString.includes(query)) return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());
  }, [scanRecords, searchTerm, statusFilter, methodFilter]);

  const latestScanTime = useMemo(() => {
    if (!todayRecords.length) return "—";
    const sorted = [...todayRecords].sort((a, b) => new Date(b.scannedAt) - new Date(a.scannedAt));
    return formatTime(sorted[0].scannedAt);
  }, [todayRecords]);

  const handleRefresh = () => {
    const nextStudents = readStorage(STUDENT_STORAGE_KEY, createDemoStudents());
    const nextScans = readStorage(SCAN_STORAGE_KEY, createDemoScans(nextStudents));
    setStudents(Array.isArray(nextStudents) ? nextStudents : createDemoStudents());
    setScanRecords(Array.isArray(nextScans) ? nextScans : []);
    setSearchTerm("");
    setStatusFilter("ALL");
    setMethodFilter("ALL");
  };

  const handleResetData = () => {
    const freshStudents = createDemoStudents();
    const freshScans = createDemoScans(freshStudents);
    setStudents(freshStudents);
    setScanRecords(freshScans);
    writeStorage(STUDENT_STORAGE_KEY, freshStudents);
    writeStorage(SCAN_STORAGE_KEY, freshScans);
    setSearchTerm("");
    setStatusFilter("ALL");
    setMethodFilter("ALL");
    setSelectedRecord(null);
  };

  const exportCsv = () => {
    const headers = [
      "Student Name",
      "Admission Number",
      "Class",
      "Date",
      "Time",
      "Method",
      "Status",
      "Scanner",
      "Details",
    ];

    const escapeCsv = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const rows = filteredRecords.map((r) => [
      r.studentName,
      r.admissionNumber,
      r.className,
      r.date,
      formatTime(r.scannedAt),
      r.method,
      r.status,
      r.scannerName,
      r.message,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `scholanode-gate-scans-${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(73,166,255,0.08),_transparent_40%),#f8fafc]">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Page Top Heading */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700">
              <ShieldCheck size={16} />
              Gate Access & Security Operations · {schoolName}
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#071A52] sm:text-3xl">
              Security Dashboard
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Welcome, <span className="font-semibold text-slate-700">{officerName}</span> ({officerLoginId}). Monitor daily student gate entries, verify access passes, and review live scan logs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Terminal Online · {officerLoginId}
            </div>
            <button
              type="button"
              onClick={() => navigate("/verify-student")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#071A52] to-[#123A8F] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-900/10 transition hover:brightness-110 cursor-pointer"
            >
              <QrCode size={17} />
              Scan & Verify Student
            </button>
          </div>
        </div>

        {/* Hero Section */}
        <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#061541] via-[#0A2463] to-[#1747A1] p-6 text-white shadow-[0_24px_60px_-30px_rgba(7,26,82,0.65)] sm:p-9">
          <div
            aria-hidden="true"
            className="absolute -right-24 -top-36 -z-10 h-96 w-96 rounded-full border-[50px] border-white/[0.06]"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-28 right-[25%] -z-10 h-64 w-64 rounded-full bg-cyan-300/[0.08] blur-3xl"
          />

          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-cyan-200 backdrop-blur-md">
                <ShieldCheck size={14} />
                {schoolCode} Gate Point · Terminal 1
              </div>

              <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                Welcome, {officerName}
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-6 text-blue-100 sm:text-base">
                Keep student entry fast, smooth, and accountable. Verify incoming students, log gate arrivals, and maintain secure campus access for <span className="font-semibold text-white">{schoolName}</span>.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-blue-100 sm:text-sm">
                <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                  <CalendarDays size={15} />
                  {formatDate(today)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-400/20 px-3 py-1.5 text-emerald-200 font-semibold backdrop-blur-sm">
                  <Activity size={15} />
                  Gate Access Active · {officerStatus}
                </span>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/verify-student")}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#071A52] shadow-sm transition hover:bg-cyan-50 hover:shadow cursor-pointer"
                >
                  <QrCode size={18} />
                  Open Gate Scanner
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 cursor-pointer"
                >
                  <Download size={16} />
                  Export Today's Scans
                </button>
              </div>
            </div>

            {/* Right-hand Hero Live KPI Widget */}
            <div className="grid w-full max-w-md grid-cols-2 gap-3 lg:max-w-[340px]">
              <div className="col-span-2 rounded-2xl border border-white/15 bg-white/[0.09] p-5 backdrop-blur-md">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-200">
                  Today's Verified Arrivals
                </p>

                <div className="mt-2 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-4xl font-black tracking-tight">{uniqueScannedStudentIds.size}</p>
                    <p className="mt-1 text-xs text-blue-100">Unique students recorded at school gate</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-300/20 text-emerald-200 shadow-sm">
                    <UserCheck size={24} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-200">Total Scans</p>
                <p className="mt-1.5 text-2xl font-black">{todayRecords.length}</p>
                <p className="mt-0.5 text-[11px] text-blue-200/80">Arrival attempts</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-200">Last Entry</p>
                <p className="mt-1.5 text-2xl font-black">{latestScanTime}</p>
                <p className="mt-0.5 text-[11px] text-blue-200/80">Most recent scan</p>
              </div>
            </div>
          </div>
        </section>

        {/* 4 Summary Stat Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Registered Students"
            value={students.length}
            description="Active roster eligible for gate entry"
            icon={Users}
            tone="blue"
          />
          <SummaryCard
            title="Students Arrived"
            value={uniqueScannedStudentIds.size}
            description="Verified gate entries recorded today"
            icon={UserCheck}
            tone="green"
          />
          <SummaryCard
            title="Pending Arrival"
            value={pendingStudentsCount}
            description="No entry recorded at the gate yet"
            icon={UserRound}
            tone="amber"
          />
          <SummaryCard
            title="Duplicates / Review"
            value={duplicateRecords.length + reviewOrFailedRecords.length}
            description="Repeated scans or manual checks"
            icon={AlertCircle}
            tone="rose"
          />
        </section>

        {/* Quick Actions */}
        <section>
          <div className="mb-3">
            <h2 className="text-base font-bold text-[#071A52]">Quick Actions & Gate Tools</h2>
            <p className="text-xs text-slate-500">Direct shortcuts for access operations and logging.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => navigate("/verify-student")}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md cursor-pointer"
            >
              <div className="rounded-xl bg-blue-50 p-3 text-[#123A8F] transition group-hover:bg-[#071A52] group-hover:text-white">
                <QrCode size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-[#071A52]">Verify Student at Gate</h3>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Scan QR badge or search admission number for immediate gate entry pass.
                </p>
              </div>
              <ArrowRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-[#123A8F]" />
            </button>

            <button
              type="button"
              onClick={() => {
                setStatusFilter("ALL");
                setMethodFilter("ALL");
                setSearchTerm("");
              }}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"
            >
              <div className="rounded-xl bg-cyan-50 p-3 text-cyan-700 transition group-hover:bg-cyan-600 group-hover:text-white">
                <Search size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-[#071A52]">Student Lookup</h3>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Quickly find student records by name or admission number.
                </p>
              </div>
              <ArrowRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-cyan-700" />
            </button>

            <button
              type="button"
              onClick={exportCsv}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
            >
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                <Download size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-[#071A52]">Download Scan Log</h3>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Export arrival records into an Excel-ready CSV sheet.
                </p>
              </div>
              <ArrowRight size={18} className="shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" />
            </button>
          </div>
        </section>

        {/* Scan Activity Table Card */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-1.5 text-[#123A8F]">
                  <Activity size={17} />
                </div>
                <h2 className="text-base font-bold text-[#071A52]">Recent Gate Scan Activity</h2>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Log of student arrival verifications captured at school gates.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#123A8F] hover:bg-blue-50 transition"
              >
                <Download size={14} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="grid gap-3 border-b border-slate-100 p-4 sm:p-5 md:grid-cols-[1fr_200px_200px]">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by student name, admission number, class or scanner..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-xs sm:text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs sm:text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="ALL">All Scan Statuses</option>
                <option value="SUCCESS">Successful Only</option>
                <option value="DUPLICATE">Duplicates Only</option>
                <option value="NEEDS_REVIEW">Needs Review</option>
                <option value="FAILED">Failed / Flagged</option>
              </select>
            </div>

            <div>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs sm:text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              >
                <option value="ALL">All Methods</option>
                <option value="QR">QR Code Scan</option>
                <option value="MANUAL">Manual Lookup</option>
              </select>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Class</th>
                  <th className="px-5 py-3">Time & Date</th>
                  <th className="px-5 py-3">Scan Method</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="transition hover:bg-slate-50/80">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={record.studentName} />
                        <div>
                          <p className="font-semibold text-slate-800">{record.studentName || "Unknown Student"}</p>
                          <p className="mt-0.5 text-xs text-slate-400">{record.admissionNumber || "No ID"}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs font-medium text-slate-600">{record.className || "—"}</td>

                    <td className="px-5 py-4">
                      <p className="text-xs font-bold text-slate-800">{formatTime(record.scannedAt)}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(record.date)}</p>
                    </td>

                    <td className="px-5 py-4">
                      <MethodBadge method={record.method} />
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={record.status} />
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedRecord(record)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#123A8F] transition hover:bg-blue-50 hover:border-blue-200"
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-14 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Search size={22} />
                      </div>
                      <p className="mt-3 font-bold text-slate-800">No matching scan records</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Try modifying your search or reset the filters to see all entries.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchTerm("");
                          setStatusFilter("ALL");
                          setMethodFilter("ALL");
                        }}
                        className="mt-4 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#123A8F] hover:bg-slate-50"
                      >
                        Clear Filters
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View */}
          <div className="divide-y divide-slate-100 md:hidden">
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                onClick={() => setSelectedRecord(record)}
                className="cursor-pointer space-y-3 p-4 transition hover:bg-slate-50/70"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={record.studentName} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">{record.studentName}</p>
                    <p className="text-xs text-slate-400">{record.admissionNumber} · {record.className}</p>
                  </div>
                  <StatusBadge status={record.status} />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                  <span className="flex items-center gap-1.5">
                    <Clock3 size={13} className="text-slate-400" />
                    {formatTime(record.scannedAt)}
                  </span>
                  <MethodBadge method={record.method} />
                </div>
              </div>
            ))}

            {filteredRecords.length === 0 && (
              <div className="p-10 text-center">
                <Search size={24} className="mx-auto text-slate-300" />
                <p className="mt-2 text-sm font-semibold text-slate-700">No records found</p>
                <p className="mt-1 text-xs text-slate-400">Try adjusting your filters.</p>
              </div>
            )}
          </div>

          {/* Footer of Table Card */}
          <div className="flex flex-col justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 text-xs text-slate-500 sm:flex-row sm:items-center">
            <span>
              Showing <strong className="text-slate-700">{filteredRecords.length}</strong> of{" "}
              <strong className="text-slate-700">{scanRecords.length}</strong> scan records
            </span>
            <span className="text-[11px] text-slate-400">
              Parent notifications are simulated during prototype mode.
            </span>
          </div>
        </section>

        {/* Important Clarification Note */}
        <section className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 shadow-sm">
          <div className="rounded-xl bg-white p-2 text-[#123A8F] shadow-sm">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h3 className="font-bold text-[#071A52]">Important: Gate Scans and Class Attendance</h3>
            <p className="mt-1 text-xs leading-6 text-slate-600 sm:text-sm">
              A gate scan confirms that a student has entered the school premises. It does not replace the classroom form
              master's official daily attendance register. A student without a gate scan must not automatically be marked
              absent, as form masters conduct the definitive roll call in class.
            </p>
          </div>
        </section>

        {/* Prototype Reset Controls */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Local Prototype Controls</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Reset local demo scans and student roster back to fresh initial sample states.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetData}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              <RefreshCw size={14} />
              Reset Demo Records
            </button>
          </div>
        </section>
      </div>

      {/* Details Dialog */}
      <ScanDetailsModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
 