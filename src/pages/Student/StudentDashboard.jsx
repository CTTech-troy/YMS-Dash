import React, { useState, useMemo, useEffect } from 'react';
import { LayoutDashboard, FileText, LogOut, ChevronRight, Menu, X, Download, Lock, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';

const StudentDashboard = ({ student = null, results = [], onLogout = null }) => {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [viewingResult, setViewingResult] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [fetchedResults, setFetchedResults] = useState(results);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [derivedStudentInfo, setDerivedStudentInfo] = useState({});

  const { currentUser, updateUserFields } = useAuth();

  // Derive display values - prioritize currentUser, then student prop, then results
  const firstResult = fetchedResults && fetchedResults.length > 0 ? fetchedResults[0] : null;
  const studentName = (
    currentUser?.studentName || currentUser?.name ||
    student?.studentName || student?.name ||
    (typeof derivedStudentInfo !== 'undefined' && derivedStudentInfo?.name) ||
    firstResult?.studentName || firstResult?.name || 'Student'
  );
  const studentUidValue = (
    currentUser?.studentUid || currentUser?.uid ||
    student?.studentUid || student?.uid ||
    (typeof derivedStudentInfo !== 'undefined' && derivedStudentInfo?.uid) ||
    firstResult?.studentUid || firstResult?.uid || ''
  );
  const studentClass = (
    currentUser?.studentClass || currentUser?.class ||
    student?.studentClass || student?.class ||
    (typeof derivedStudentInfo !== 'undefined' && derivedStudentInfo?.class) ||
    firstResult?.studentClass || firstResult?.class || ''
  );

  // active UID to use for fetching and persistence (prefer currentUser when available)
  const activeUid = currentUser?.uid || currentUser?.studentUid || student?.uid || student?.studentUid || studentUidValue || '';

  // Log all student information
  useEffect(() => {
    console.log('=== LOGGED IN STUDENT DETAILS ===');
    console.log('Name:', studentName);
    console.log('UID:', studentUidValue);
    console.log('Class:', studentClass);
    console.log('Full student object:', student);
    console.log('==============================');
  }, [studentName, studentUidValue, studentClass, student]);

  // Consolidated display student object - prefer currentUser, then student prop, then derived info, then firstResult
  const displayStudent = {
    name: studentName,
    studentName: studentName,
    uid: studentUidValue,
    studentUid: studentUidValue,
    class: studentClass,
    studentClass: studentClass,
    picture: currentUser?.picture || student?.picture || derivedStudentInfo?.picture || firstResult?.picture || '/images/default-avatar.png',
    fees: currentUser?.fees || student?.fees || derivedStudentInfo?.fees || firstResult?.fees || { total: 0, paid: 0, pending: 0 },
    session: currentUser?.session || student?.session || derivedStudentInfo?.session || firstResult?.session || '',
    term: currentUser?.term || student?.term || derivedStudentInfo?.term || firstResult?.term || '',
  };



  // Fetch results from API on mount

  useEffect(() => {
    if (!activeUid) return;

    const API_BASE = import.meta.env.VITE_API_URL || 'https://yms-backend-a2x4.onrender.com';

    const normalizeString = (v) => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'string') return v.trim();
      if (typeof v === 'number') return String(v);
      return '';
    };

    const parseBool = (v) => {
      if (v === true || v === 1) return true;
      if (v === false || v === 0) return false;
      if (typeof v === 'string') {
        const s = v.trim().toLowerCase();
        return s === 'true' || s === 'yes' || s === '1';
      }
      return Boolean(v);
    };

    const fetchData = async () => {
      try {
        const paramKey = 'uid';
        const queryValue = encodeURIComponent(activeUid);

        const resultsResp = await fetch(`${API_BASE}/api/results?${paramKey}=${queryValue}`);

        if (!resultsResp.ok) {
          const text = await resultsResp.text().catch(() => '');
          console.error('Results API error', resultsResp.status, resultsResp.statusText, text);
          toast.error('Failed to load results (see console)');
          return;
        }

        const resultsData = await resultsResp.json().catch((e) => {
          console.error('Failed to parse results JSON', e);
          toast.error('Invalid results response');
          return null;
        });
        if (!resultsData) return;

        const parsedResults = Array.isArray(resultsData)
          ? resultsData
          : resultsData.data || resultsData.results || [];

        const normalized = parsedResults.map((r) => {
          const studentObj = r.student || r.studentInfo || r.profile || {};

          const studentNameVal = normalizeString(r.studentName) || normalizeString(r.studentname) || normalizeString(r.name) || normalizeString(studentObj.name) || normalizeString(studentObj.fullName) || normalizeString(studentObj.studentName) || '';
          const studentClassVal = normalizeString(r.studentClass) || normalizeString(r.studentclass) || normalizeString(r.class) || normalizeString(studentObj.class) || normalizeString(studentObj.studentClass) || '';
          const studentUidVal = normalizeString(r.studentUid) || normalizeString(r.studentuid) || normalizeString(r.uid) || normalizeString(studentObj.uid) || normalizeString(studentObj.studentUid) || '';
          const studentIdVal = normalizeString(r.studentId) || normalizeString(r.studentid) || normalizeString(r.id) || normalizeString(studentObj.id) || '';

          const teacherCommentVal = normalizeString(r.teacherComment) || normalizeString(r.teacher_comment) || normalizeString(r.comment) || normalizeString(r.teacherRemark) || normalizeString(r.teacher?.comment) || '';
          const principalCommentVal = normalizeString(r.principalComment) || normalizeString(r.principal_comment) || normalizeString(r.principal?.comment) || '';

          const commentStatusVal = parseBool(r.commentStatus ?? r.comment_status ?? r.commentsAvailable ?? false);

          const publishedRaw = r.published ?? r.isPublished ?? r.publishedFlag ?? '';
          const isPublished = parseBool(publishedRaw);
          const publishedVal = isPublished ? 'yes' : 'no';

          const createdAtVal = normalizeString(r.createdAt) || normalizeString(r.created_at) || normalizeString(r.timestamp) || '';
          const publishedAtVal = normalizeString(r.publishedAt) || normalizeString(r.published_at) || '';

          const sessionVal = normalizeString(r.session) || normalizeString(r.academicSession) || '';
          const termVal = normalizeString(r.term) || normalizeString(r.academicTerm) || '';

          return {
            // canonical identity
            studentName: studentNameVal || null,
            studentClass: studentClassVal || null,
            studentUid: studentUidVal || null,
            studentId: studentIdVal || null,
            // comments & meta
            teacherComment: teacherCommentVal || null,
            principalComment: principalCommentVal || null,
            teacherUid: normalizeString(r.teacherUid) || normalizeString(r.teacher_uid) || normalizeString(r.teacher) || null,
            commentStatus: commentStatusVal,
            published: publishedVal,
            publishedBool: isPublished,
            createdAt: createdAtVal || null,
            publishedAt: publishedAtVal || null,
            session: sessionVal || null,
            term: termVal || null,
            // subjects (keep original if nested differently)
            subjects: Array.isArray(r.subjects) && r.subjects.length > 0 ? r.subjects : (Array.isArray(r.subject_list) ? r.subject_list : (Array.isArray(r.subjectsArray) ? r.subjectsArray : [])),
            // keep original payload for anything else
            raw: r,
            ...r,
          };
        });

        setFetchedResults(normalized);

        // derive a simple student info object from the first normalized record
        if (normalized && normalized.length > 0) {
          const first = normalized[0];
          const reconstructed = {
            // identity
            name: first.studentName || first.name || '',
            studentName: first.studentName || first.name || '',
            uid: first.studentUid || first.uid || '',
            studentUid: first.studentUid || first.uid || '',
            studentId: first.studentId || first.id || '',
            // class
            class: first.studentClass || first.class || '',
            studentClass: first.studentClass || first.class || '',
            // academic
            session: first.session || '',
            term: first.term || '',
            // media & fees
            picture: first.picture || first.studentPhoto || '/images/default-avatar.png',
            fees: first.fees || { total: 0, paid: 0, pending: 0 },
            // comments & metadata
            teacherComment: first.teacherComment || null,
            principalComment: first.principalComment || null,
            commentStatus: first.commentStatus ?? false,
            published: first.published || 'no',
            publishedAt: first.publishedAt || null,
            createdAt: first.createdAt || null,
            // raw first result for reference
            _raw: first,
          };

          setDerivedStudentInfo(reconstructed);
          console.log('Reconstructed student info for logged UID:', reconstructed);

          // If currentUser exists and lacks or differs in name/class, update it in context + localStorage
          try {
            if (typeof updateUserFields === 'function' && currentUser) {
              const needsUpdate = (
                (currentUser.studentName !== reconstructed.studentName) ||
                (currentUser.studentClass !== reconstructed.studentClass) ||
                (currentUser.name !== reconstructed.name) ||
                (currentUser.class !== reconstructed.class)
              );
              if (needsUpdate) {
                updateUserFields({
                  name: reconstructed.name,
                  studentName: reconstructed.studentName,
                  class: reconstructed.class,
                  studentClass: reconstructed.studentClass,
                });
                console.log('Updated currentUser with reconstructed studentName/studentClass');
              }
            }
          } catch (e) {
            console.warn('Could not update currentUser with reconstructed info', e);
          }
        }
      } catch (_error) {
        console.error('Failed to fetch results:', _error);
        toast.error('Failed to load results (unexpected error)');
      }
    };

    fetchData();
  }, [activeUid]);

  // Process results: flatten subjects array if present
  const processedResults = useMemo(() => {
    const all = fetchedResults.map(result => {
      // If result has subjects array, expand each subject as a separate row
      if (Array.isArray(result.subjects) && result.subjects.length > 0) {
        return result.subjects.map(subject => ({
          ...subject,
          session: result.session,
          term: result.term,
          studentUid: result.studentUid,
          studentId: result.studentId,
          teacherComment: result.teacherComment,
          principalComment: result.principalComment,
          teacherUid: result.teacherUid,
          published: result.published,
          commentStatus: result.commentStatus
        }));
      }
      // Otherwise return result as-is
      return [result];
    }).flat();

    // If a student UID is available, filter rows to only that student's UID (normalize comparison)
    if (activeUid) {
      const normalizedStudentUid = String(activeUid).toLowerCase();
      return all.filter(r => String(r.studentUid || r.uid || r.studentId || '').toLowerCase() === normalizedStudentUid);
    }

    return all;
  }, [fetchedResults, activeUid]);

  // Group processed results by session -> term
  const groupedResults = useMemo(() => {
    const grouped = {};
    processedResults.forEach(r => {
      const session = r.session || 'Unknown Session';
      const term = r.term || 'Unknown Term';
      if (!grouped[session]) grouped[session] = {};
      if (!grouped[session][term]) grouped[session][term] = [];
      grouped[session][term].push(r);
    });
    return grouped;
  }, [processedResults]);

  const sessions = Object.keys(groupedResults).sort();
  const terms = selectedSession ? Object.keys(groupedResults[selectedSession] || {}) : [];
  const termResults = selectedSession && selectedTerm ? groupedResults[selectedSession]?.[selectedTerm] || [] : [];
  // only display up to 10 subject rows per term for the student
  const VISIBLE_SUBJECT_LIMIT = 10;
  const visibleTermResults = termResults.slice(0, VISIBLE_SUBJECT_LIMIT);

  // Calculate fee status (use consolidated displayStudent)
  const feesPaid = displayStudent.fees?.total === displayStudent.fees?.paid || (displayStudent.fees?.paid >= displayStudent.fees?.total);

  // Get subject name from result/subject object
  const getSubjectName = (result) => {
    // Handle both flattened subject objects and regular result objects
    return (
      result?.name ||           // From flattened subject object
      result?.subjectName ||
      result?.subject?.name ||
      result?.subject ||
      result?.code ||
      'Subject'
    );
  };

  const calculateGrade = percentage => {
    if (percentage >= 90) return 'A+';
    if (percentage >= 70) return 'A';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 45) return 'D';
    if (percentage >= 40) return 'E';
    return 'F';
  };

  const calculateOverallGrade = subjectsArr => {
    if (!subjectsArr || subjectsArr.length === 0) return { percentage: 0, grade: 'F' };

    // Sum total marks obtained across all subjects. Support multiple field names.
    const totalObtained = subjectsArr.reduce((sum, subject) => {
      const sTotal = subject?.total ?? (
        (subject?.firstTest || subject?.first || 0) +
        (subject?.secondTest || subject?.second || 0) +
        (subject?.thirdTest || subject?.third || 0) +
        (subject?.exam || subject?.examScore || 0)
      );
      return sum + (Number(sTotal) || 0);
    }, 0);

    const maxPerSubject = 100; // fallback per-subject maximum
    const totalMarksObtainable = (subjectsArr.length || 0) * maxPerSubject;

    const overallPercentage = totalMarksObtainable > 0
      ? (totalObtained / totalMarksObtainable) * 100
      : 0;

    const rounded = parseFloat(overallPercentage.toFixed(1));
    const overallGrade = calculateGrade(rounded);
    return { percentage: rounded, grade: overallGrade };
  };

  const handleLogout = () => {
    try {
      // Clear persisted dashboard state and session from localStorage
      localStorage.removeItem('studentDashboardSession');
      if (activeUid) {
        localStorage.removeItem(`yms_student_dashboard_${activeUid}`);
      }
    } catch (e) {
      console.error('Failed to clear persisted student dashboard data', e);
    }
    if (onLogout) onLogout();
    toast.success('Logged out successfully');
  };

  // Password change handler
  const handlePasswordChange = async (e) => {
    e.preventDefault();

    // Validation
    if (!passwordForm.currentPassword) {
      toast.error('Please enter your current password');
      return;
    }
    if (!passwordForm.newPassword) {
      toast.error('Please enter a new password');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    // Verify current password (must be 'student123' initially)
    if (passwordForm.currentPassword !== 'student123') {
      toast.error('Current password is incorrect');
      return;
    }

    setChangingPassword(true);
    try {
      // Store new password in localStorage
      if (activeUid) {
        localStorage.setItem(`studentPassword_${activeUid}`, passwordForm.newPassword);
      }
      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
    } catch {
      toast.error('Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  // Download PDF function
  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const { autoTable } = await import('jspdf-autotable');
      
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPos = 10;
      // Try to draw a watermark using the school logo (low opacity)
      const logoUrl = import.meta.env.VITE_SCHOOL_LOGO || '/logo.png';

      const loadLogoAsDataUrl = async (url, alpha = 0.06) => {
        try {
          const resp = await fetch(url);
          if (!resp.ok) return null;
          const blob = await resp.blob();

          // Create an ImageBitmap for reliable sizing
          const imgBitmap = await createImageBitmap(blob);

          // Create a canvas and draw the image with low alpha
          const canvas = document.createElement('canvas');
          // scale down large images to reasonable size
          const maxDim = Math.max(imgBitmap.width, imgBitmap.height);
          const scale = maxDim > 1200 ? 1200 / maxDim : 1;
          const drawW = Math.round(imgBitmap.width * scale);
          const drawH = Math.round(imgBitmap.height * scale);
          canvas.width = drawW;
          canvas.height = drawH;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.globalAlpha = alpha;
          ctx.drawImage(imgBitmap, 0, 0, drawW, drawH);

          const dataUrl = canvas.toDataURL('image/png');
          return { dataUrl, width: drawW, height: drawH };
        } catch (e) {
          console.warn('Could not load watermark logo', e);
          return null;
        }
      };

      let watermarkObj = null;
      try {
        watermarkObj = await loadLogoAsDataUrl(logoUrl, 0.06);
        if (watermarkObj) {
          // center the watermark and scale to 60% of page width
          const desiredW = pageWidth * 0.6;
          const desiredH = watermarkObj.height * (desiredW / watermarkObj.width);
          const wx = (pageWidth - desiredW) / 2;
          const wy = (pageHeight - desiredH) / 2;
          try {
            pdf.addImage(watermarkObj.dataUrl, 'PNG', wx, wy, desiredW, desiredH);
          } catch (e) {
            console.warn('Failed to add watermark to PDF', e);
          }
        }
      } catch (e) {
        console.warn('Watermark step failed', e);
      }
      
      // ========== HEADER SECTION ==========
      pdf.setDrawColor(76, 175, 80);
      pdf.setLineWidth(0.5);
      pdf.rect(10, yPos, pageWidth - 20, 25);
      
      pdf.setFontSize(18);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(76, 175, 80);
      pdf.text('YETLAND GROUP OF SCHOOL', pageWidth / 2, yPos + 8, { align: 'center' });
    //   pdf.text('STUDENT ACADEMIC RESULT SHEET', pageWidth / 2, yPos + 8, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'normal');
      pdf.setTextColor(100);
      pdf.text('STUDENT ACADEMIC RESULT SHEET', pageWidth / 2, yPos + 16, { align: 'center' });
    //   pdf.text('YETLAND GROUP OF SCHOOL', pageWidth / 2, yPos + 16, { align: 'center' });
      
      pdf.setFontSize(9);
      pdf.setTextColor(120);
      pdf.text(`${selectedSession} - ${selectedTerm}`, pageWidth / 2, yPos + 22, { align: 'center' });
      
      yPos += 32;
      
      // ========== STUDENT INFO SECTION ==========
      pdf.setFontSize(10);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(0);
      
      const infoBoxY = yPos;
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.3);
      pdf.rect(10, infoBoxY - 2, pageWidth - 20, 24);
      
      pdf.text('Student Information', 12, infoBoxY + 3);
      
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(9);
      
      const colWidth = (pageWidth - 24) / 2;
      pdf.text(`Name:`, 10, infoBoxY + 10);
      pdf.text(`${displayStudent.name || 'N/A'}`, 40, infoBoxY + 10);

      pdf.text(`Student ID:`, 10, infoBoxY + 16);
      pdf.text(`${displayStudent.uid || 'N/A'}`, 40, infoBoxY + 16);

      pdf.text(`Class:`, 10 + colWidth, infoBoxY + 10);
      pdf.text(`${displayStudent.class || 'N/A'}`, 40 + colWidth, infoBoxY + 10);

      pdf.text(`Date Generated:`, 10 + colWidth, infoBoxY + 16);
      pdf.text(`${new Date().toLocaleDateString()}`, 40 + colWidth, infoBoxY + 16);

      
      yPos += 32;
      
      // ========== RESULTS TABLE ==========
      const overallGrade = calculateOverallGrade(termResults);
      
      const tableData = termResults.map(r => [
        getSubjectName(r) || 'N/A',
        (r.ca1 ?? r.firstTest ?? 0).toString(),
        (r.ca2 ?? r.secondTest ?? 0).toString(),
        (r.ca3 ?? r.thirdTest ?? 0).toString(),
        (r.exam ?? 0).toString(),
        (r.total ?? 0).toString(),
        // (typeof r.percentage === 'number' ? r.percentage.toFixed(1) : r.percentage || 0).toString(),
        (r.grade || 'N/A').toString()
      ]);
      
      autoTable(pdf, {
        head: [['Subject', 'CA1', 'CA2', 'CA3', 'Exam', 'Total', 'Grade']],
        body: tableData,
        startY: yPos,
        headStyles: {
          fillColor: [76, 175, 80],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10,
          halign: 'center',
          valign: 'middle'
        },
        bodyStyles: {
          fontSize: 9,
          halign: 'center',
          textColor: 0
        },
        alternateRowStyles: {
          fillColor: [245, 250, 245]
        },
        rowStyles: {
          0: { fillColor: [255, 255, 255] }
        },
        columnStyles: {
          0: { halign: 'left', fillColor: [255, 255, 255] },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center', fontStyle: 'bold' },
          6: { halign: 'center' },
          7: { halign: 'center', fontStyle: 'bold' }
        },
        margin: { top: 10, right: 10, bottom: 30, left: 10 },
        didDrawPage: (data) => {
          // Optional: draw page borders or decorations
        }
      });
      
      yPos = pdf.lastAutoTable.finalY + 15;
      
      // ========== PERFORMANCE SUMMARY ==========
      pdf.setFontSize(11);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(76, 175, 80);
      pdf.text('Overall Academic Performance', 12, yPos);
      
      pdf.setDrawColor(76, 175, 80);
      pdf.setLineWidth(0.5);
      pdf.line(12, yPos + 2, pageWidth - 12, yPos + 2);
      
      yPos += 8;
      
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(0);
      
      const summaryBoxY = yPos;
      pdf.setFillColor(245, 250, 245);
      pdf.rect(12, summaryBoxY, (pageWidth - 24) / 3 - 3, 18, 'F');
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(76, 175, 80);
      pdf.text('Percentage', 12 + ((pageWidth - 24) / 3 - 3) / 2, summaryBoxY + 7, { align: 'center' });
      pdf.setFontSize(14);
      pdf.text(`${overallGrade.percentage}%`, 12 + ((pageWidth - 24) / 3 - 3) / 2, summaryBoxY + 14, { align: 'center' });
      
      pdf.setFillColor(245, 250, 245);
      pdf.rect(12 + (pageWidth - 24) / 3, summaryBoxY, (pageWidth - 24) / 3 - 3, 18, 'F');
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(76, 175, 80);
      pdf.text('Total Subjects', 12 + (pageWidth - 24) / 3 + ((pageWidth - 24) / 3 - 3) / 2, summaryBoxY + 7, { align: 'center' });
      pdf.setFontSize(14);
      pdf.text(`${termResults.length}`, 12 + (pageWidth - 24) / 3 + ((pageWidth - 24) / 3 - 3) / 2, summaryBoxY + 14, { align: 'center' });
      
      pdf.setFillColor(245, 250, 245);
      pdf.rect(12 + (2 * (pageWidth - 24) / 3), summaryBoxY, (pageWidth - 24) / 3 - 3, 18, 'F');
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(76, 175, 80);
      pdf.text('Overall Grade', 12 + (2 * (pageWidth - 24) / 3) + ((pageWidth - 24) / 3 - 3) / 2, summaryBoxY + 7, { align: 'center' });
      pdf.setFontSize(14);
      pdf.setFont(undefined, 'bold');
      pdf.setTextColor(30, 144, 255);
      pdf.text(`${overallGrade.grade}`, 12 + (2 * (pageWidth - 24) / 3) + ((pageWidth - 24) / 3 - 3) / 2, summaryBoxY + 14, { align: 'center' });
      
      yPos += 28;
      
      // ========== COMMENTS SECTION ==========
      const currentResult = termResults[0];
      
      // Teacher Comments
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(76, 175, 80);
      pdf.text("Teacher's Comments", 12, yPos);
      
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.3);
      pdf.setFillColor(250, 250, 250);
      pdf.rect(12, yPos + 2, pageWidth - 24, 15, 'F');
      
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(50);
      const teacherComments = currentResult?.teacherComment || 'No comments from teacher';
      const teacherLines = pdf.splitTextToSize(teacherComments, pageWidth - 28);
      pdf.text(teacherLines, 14, yPos + 6);
      
      yPos += 20;
      
      // Principal Comments
      pdf.setFont(undefined, 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(76, 175, 80);
      pdf.text("Principal's Comments", 12, yPos);
      
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.3);
      pdf.setFillColor(250, 250, 250);
      pdf.rect(12, yPos + 2, pageWidth - 24, 15, 'F');
      
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(50);
      const principalComments = currentResult?.principalComment || 'No comments from principal';
      const principalLines = pdf.splitTextToSize(principalComments, pageWidth - 28);
      pdf.text(principalLines, 14, yPos + 6);
      
      // ========== FOOTER ==========
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.setDrawColor(200, 200, 200);
      pdf.line(10, pageHeight - 12, pageWidth - 10, pageHeight - 12);
      pdf.text(`Generated on: ${new Date().toLocaleDateString()} | YMS School Management System`, pageWidth / 2, pageHeight - 8, { align: 'center' });
      
      // Download
      pdf.save(`${displayStudent.name || 'Result'}_${selectedSession}_${selectedTerm}.pdf`);
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast.error('Failed to download PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-4 left-4 z-40 md:hidden bg-white p-2 rounded-lg shadow"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar - Fixed on desktop, overlay on mobile */}
      <div
        className={`fixed left-0 top-0 h-screen w-64 bg-white shadow-lg flex flex-col z-50 transform transition-transform duration-300 md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:z-0`}
      >
        {/* Student Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white text-green-600 font-bold text-lg mx-auto mb-3">
            {(displayStudent.name || 'S').charAt(0)}
          </div>
          <h2 className="text-center font-semibold text-sm truncate">{displayStudent.name || 'Student'}</h2>
          <p className="text-center text-xs text-green-100 mt-1">{displayStudent.uid || 'N/A'}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <button
            onClick={() => {
              setActiveView('dashboard');
              setSelectedSession(null);
              setSelectedTerm(null);
              setViewingResult(null);
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition ${
              activeView === 'dashboard' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </button>
          <button
            onClick={() => {
              setActiveView('results');
              setViewingResult(null);
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition ${
              activeView === 'results' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <FileText size={20} />
            <span className="font-medium">Results</span>
          </button>
          <button
            onClick={() => {
              setActiveView('settings');
              setViewingResult(null);
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition ${
              activeView === 'settings' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Lock size={20} />
            <span className="font-medium">Settings</span>
          </button>
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Main Content */}
      <div className="ml-0 md:ml-64 min-h-screen bg-gray-100 pt-16 md:pt-0">
        {/* Dashboard View */}
        {activeView === 'dashboard' && (
          <div className="p-4 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">Dashboard</h1>

            {/* Student Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {/* Name Card */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Name</h3>
                <p className="text-2xl font-bold text-gray-900 mt-2">{displayStudent.name || 'N/A'}</p>
              </div>

              {/* UID Card */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Student ID</h3>
                <p className="text-2xl font-bold text-gray-900 mt-2">{displayStudent.uid || 'N/A'}</p>
              </div>

              {/* Class Card */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-sm font-medium text-gray-500 uppercase">Class</h3>
                <p className="text-2xl font-bold text-gray-900 mt-2">{displayStudent.class || 'N/A'}</p>
              </div>
            </div>

            {/* Fee Status */}
            <div className="mt-6 md:mt-8 bg-white rounded-lg shadow p-6 md:p-8">
              <h3 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6">School Fee Status</h3>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-600">Payment Status</p>
                  <p className="text-lg md:text-xl font-semibold text-gray-900 mt-1">
                    Total: ${displayStudent.fees?.total || 0}
                  </p>
                </div>
                <div className={`flex items-center gap-3 px-4 md:px-6 py-2 md:py-3 rounded-lg ${
                  feesPaid ? 'bg-green-100' : 'bg-yellow-100'
                }`}>
                  <div className={`w-4 h-4 rounded-full ${
                    feesPaid ? 'bg-green-600' : 'bg-yellow-600'
                  }`}></div>
                  <span className={`font-semibold text-sm md:text-base ${
                    feesPaid ? 'text-green-800' : 'text-yellow-800'
                  }`}>
                    {feesPaid ? 'FULLY PAID' : 'PENDING'}
                  </span>
                </div>
              </div>
              {!feesPaid && (
                <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400">
                  <p className="text-sm text-yellow-800">
                    Pending: ${displayStudent.fees?.pending || 0}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results View */}
        {activeView === 'results' && !viewingResult && (
          <div className="p-4 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">Results</h1>

            {fetchedResults.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 md:p-12 text-center">
                <p className="text-gray-500 text-lg">No results available</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-6">
                {/* Sessions Sidebar */}
                <div className="bg-white rounded-lg shadow">
                  <div className="border-b border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-900">Sessions</h3>
                  </div>
                  <div className="p-4 space-y-2">
                    {sessions.map(session => (
                      <button
                        key={session}
                        onClick={() => {
                          setSelectedSession(session);
                          setSelectedTerm(null);
                        }}
                        className={`w-full text-left px-4 py-2 rounded-lg transition ${
                          selectedSession === session
                            ? 'bg-green-100 text-green-700 border-l-4 border-green-600'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        {session}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Terms & Results */}
                <div className="lg:col-span-3">
                  {!selectedSession ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                      <p className="text-gray-500 text-lg">Select a session to view terms</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Terms */}
                      <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">Terms</h3>
                        <div className="flex flex-wrap gap-3">
                          {terms.map(term => (
                            <button
                              key={term}
                              onClick={() => setSelectedTerm(term)}
                              className={`px-4 py-2 rounded-lg font-medium transition ${
                                selectedTerm === term
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {term}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Results Table */}
                          {selectedTerm && termResults.length > 0 && (
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                          <div className="p-6 border-b border-gray-200">
                            <h3 className="font-semibold text-gray-900">
                              {selectedSession} - {selectedTerm}
                            </h3>
                          </div>
                          
                          {/* Check if result is published */}
                          {(() => {
                            const resultForTerm = termResults[0];
                            const isPublished = resultForTerm?.published === 'yes' || 
                                               resultForTerm?.published === true || 
                                               String(resultForTerm?.published).toLowerCase() === 'true' ||
                                               resultForTerm?.published === 1;
                            
                            if (!isPublished) {
                              return (
                                <div className="p-6 bg-yellow-50 border-l-4 border-yellow-400">
                                  <p className="text-yellow-800 font-medium">
                                    Results for {selectedTerm} have not been published yet. Please check back later.
                                  </p>
                                </div>
                              );
                            }
                            
                            return (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm md:text-base">
                                  <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                      <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs md:text-xs font-medium text-gray-500 uppercase">Subject</th>
                                      <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">CA1</th>
                                      <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">CA2</th>
                                      <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">CA3</th>
                                      <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
                                      <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                                      {/* <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">%</th> */}
                                      <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200">
                                    {visibleTermResults.map((r, idx) => (
                                      <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-3 md:px-6 py-2 md:py-4 font-medium text-gray-900">
                                          {getSubjectName(r)}
                                        </td>
                                        <td className="px-2 md:px-6 py-2 md:py-4 text-gray-600">{r.ca1 ?? r.firstTest ?? 0}</td>
                                        <td className="px-2 md:px-6 py-2 md:py-4 text-gray-600">{r.ca2 ?? r.secondTest ?? 0}</td>
                                        <td className="px-2 md:px-6 py-2 md:py-4 text-gray-600">{r.ca3 ?? r.thirdTest ?? 0}</td>
                                        <td className="px-2 md:px-6 py-2 md:py-4 text-gray-600">{r.exam ?? 0}</td>
                                        <td className="px-2 md:px-6 py-2 md:py-4 font-medium text-gray-900">{r.total ?? 0}</td>
                                        <td className="px-2 md:px-6 py-2 md:py-4 text-gray-600 font-medium">{r.percentage ?? 0}%</td>
                                        {/* <td className="px-2 md:px-6 py-2 md:py-4">
                                          <span className="px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-semibold bg-blue-100 text-blue-800">
                                            {r.grade || 'N/A'}
                                          </span>
                                        </td> */}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {termResults.length > visibleTermResults.length && (
                                  <div className="p-4 border-t border-gray-100 bg-gray-50 text-sm text-gray-600">
                                    Showing {visibleTermResults.length} of {termResults.length} subjects. Only the first {VISIBLE_SUBJECT_LIMIT} subjects are displayed.
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          
                          <div className="p-6 bg-gray-50 border-t border-gray-200">
                            <button
                              onClick={() => setViewingResult(termResults[0])}
                              className="inline-flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                            >
                              <FileText size={18} />
                              View Full Result
                            </button>
                          </div>
                        </div>
                      )}

                      {selectedTerm && termResults.length === 0 && (
                        <div className="bg-white rounded-lg shadow p-12 text-center">
                          <p className="text-gray-500 text-lg">No results for {selectedTerm}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Result Detail View */}
        {viewingResult && (
          <div className="p-4 md:p-8">
            <button
              onClick={() => setViewingResult(null)}
              className="flex items-center gap-2 text-green-600 hover:text-green-700 mb-4 md:mb-6 font-medium text-sm md:text-base"
            >
              <ChevronRight size={20} className="rotate-180" />
              Back to Results
            </button>

            {/* Check if result is published */}
            {(() => {
              const isPublished = viewingResult?.published === 'yes' || 
                                 viewingResult?.published === true || 
                                 String(viewingResult?.published).toLowerCase() === 'true' ||
                                 viewingResult?.published === 1;

              if (!isPublished) {
                return (
                  <div className="bg-yellow-50 rounded-lg shadow p-6 border-l-4 border-yellow-400">
                    <p className="text-yellow-800 font-medium text-lg">
                      Results for {selectedSession} - {selectedTerm} have not been published yet. Please check back later.
                    </p>
                  </div>
                );
              }

              return (
                <div className="bg-white rounded-lg shadow p-4 md:p-8">
                  <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6">
                    <div>
                      <h2 className="text-xl md:text-2xl font-bold text-gray-900">{selectedSession} - {selectedTerm}</h2>
                      <p className="text-sm md:text-base text-gray-600 mt-1">{displayStudent.name} ({displayStudent.uid})</p>
                      <p className="text-xs text-gray-500 mt-2">{
                        (() => {
                          const meta = (termResults && termResults[0]) || {};
                          const pubText = meta?.publishedBool ? 'Yes' : (meta?.published || 'No');
                          const created = meta?.createdAt ? new Date(meta.createdAt).toLocaleString() : (meta?.raw?.createdAt || meta?.raw?.created_at || 'N/A');
                          return (`Published: ${pubText} • Created: ${created} • Principal: ${meta?.principalComment || 'N/A'}`);
                        })()
                      }</p>
                    </div>
                    <button
                      onClick={handleDownloadPDF}
                      disabled={downloading}
                      className="inline-flex items-center justify-center gap-2 px-4 md:px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download size={18} />
                      {downloading ? 'Generating...' : 'Download PDF'}
                    </button>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm md:text-base">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 md:px-6 py-2 md:py-3 text-left text-xs md:text-xs font-medium text-gray-500 uppercase">Subject</th>
                            <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">CA1</th>
                            <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">CA2</th>
                            <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">CA3</th>
                            <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Exam</th>
                            <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                            <th className="px-2 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {termResults.map((r, idx) => (
                            <tr key={idx}>
                              <td className="px-3 md:px-6 py-2 md:py-4 font-medium text-gray-900">{getSubjectName(r)}</td>
                              <td className="px-2 md:px-6 py-2 md:py-4 text-gray-600">{r.ca1 ?? r.firstTest ?? 0}</td>
                              <td className="px-2 md:px-6 py-2 md:py-4 text-gray-600">{r.ca2 ?? r.secondTest ?? 0}</td>
                              <td className="px-2 md:px-6 py-2 md:py-4 text-gray-600">{r.ca3 ?? r.thirdTest ?? 0}</td>
                              <td className="px-2 md:px-6 py-2 md:py-4 text-gray-600">{r.exam ?? 0}</td>
                              <td className="px-2 md:px-6 py-2 md:py-4 font-medium text-gray-900">{r.total ?? 0}</td>
                              <td className="px-2 md:px-6 py-2 md:py-4">
                                <span className="px-2 md:px-3 py-1 rounded-full text-xs md:text-sm font-semibold bg-blue-100 text-blue-800">
                                  {r.grade || 'N/A'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Overall Percentage Section */}
                  {(() => {
                    const overallGrade = calculateOverallGrade(termResults);
                    return (
                      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Overall Performance</p>
                            <p className="text-3xl font-bold text-blue-600 mt-1">{overallGrade.percentage}%</p>
                            <p className="text-sm text-gray-600 mt-1">Grade: {overallGrade.grade}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Total Subjects</p>
                            <p className="text-2xl font-bold text-gray-900 mt-1">{visibleTermResults.length}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </div>
        )}

        {/* Settings View */}
        {activeView === 'settings' && (
          <div className="p-4 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6 md:mb-8">Settings</h1>

            {/* Change Password Card */}
            <div className="bg-white rounded-lg shadow p-4 md:p-8 max-w-2xl">
              <div className="flex items-center gap-3 mb-6">
                <Lock size={24} className="text-green-600" />
                <h2 className="text-xl md:text-2xl font-bold text-gray-900">Change Password</h2>
              </div>

              {!showPasswordForm ? (
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
                >
                  Change Password
                </button>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  {/* Current Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswordFields ? 'text' : 'password'}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        placeholder="Enter your current password"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordFields(!showPasswordFields)}
                        className="absolute right-3 top-2.5 text-gray-500"
                      >
                        {showPasswordFields ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <input
                      type={showPasswordFields ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="Enter your new password"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm Password
                    </label>
                    <input
                      type={showPasswordFields ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="Confirm your new password"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={changingPassword}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                    >
                      {changingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordForm(false);
                        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                      }}
                      className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-medium transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Account Info Card */}
            <div className="bg-white rounded-lg shadow p-4 md:p-8 max-w-2xl mt-6">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">Account Information</h2>
              <div className="space-y-4">
                <div className="pb-4 border-b border-gray-200">
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="text-lg font-semibold text-gray-900">{displayStudent.name || 'N/A'}</p>
                </div>
                <div className="pb-4 border-b border-gray-200">
                  <p className="text-sm text-gray-600">Student UID</p>
                  <p className="text-lg font-semibold text-gray-900">{displayStudent.uid || 'N/A'}</p>
                </div>
                <div className="pb-4 border-b border-gray-200">
                  <p className="text-sm text-gray-600">Class</p>
                  <p className="text-lg font-semibold text-gray-900">{displayStudent.class || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Last Password Change</p>
                  <p className="text-lg text-gray-900">Not recorded</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentDashboard;
