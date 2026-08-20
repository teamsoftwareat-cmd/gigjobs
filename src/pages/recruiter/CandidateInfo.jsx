import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faArrowLeft,
  faDownload,
  faCamera,
  faEnvelope,
  faPhone,
  faMapMarkerAlt,
  faIdCard,
  faCheckCircle,
  faTimesCircle,
  faExclamationTriangle,
  faUser,
  faGraduationCap,
  faUsers,
  faInfoCircle,
  faUpload,
} from '@fortawesome/free-solid-svg-icons';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Card } from '../../components/ui/index';
import { recruiterAPI } from '../../api/axios';
import heic2any from 'heic2any';

// ---------- Helpers (unchanged) ----------
const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const calculateAge = (dob) => {
  if (!dob || dob === '—') return '—';
  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return '—';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  return age;
};

const parseSkills = (skills) => {
  if (Array.isArray(skills)) return skills;
  if (typeof skills === 'string') {
    try {
      const parsed = JSON.parse(skills);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
    return skills.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const normalizeCandidate = (raw) => {
  if (!raw) return null;
  return {
    ...raw,
    aadhaarFront:
      raw.aadhaarFront ||
      raw.aadhaar_front ||
      raw.aadhaar_front_image ||
      raw.aadhaar_front_url ||
      null,
    aadhaarBack:
      raw.aadhaarBack ||
      raw.aadhaar_back ||
      raw.aadhaar_back_image ||
      raw.aadhaar_back_url ||
      null,
    profileImage: raw.profileImage || raw.profile_image || null,
    currentStatus: raw.currentStatus || raw.current_status || '—',
    skills: parseSkills(raw.skills),
  };
};

const normalizeOcrResponse = (response) => {
  const payload = response?.data?.data?.data || response?.data?.data || response?.data;
  if (!payload) return null;
  return {
    ...payload,
    success: response?.data?.success ?? payload?.success,
    message: response?.data?.message ?? payload?.message,
    xml_url: payload?.xml_url || payload?.xmlUrl || null,
    client_id: payload?.client_id || payload?.clientId || null,
  };
};

// ---------- HEIC Converter ----------
const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

const HEIC_URL_PATTERN = /(?:\.heic|\.heif)(?:[?#]|$)/i;

const getDisplayableImageUrl = async (url) => {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Image fetch failed:', response.status, response.statusText, url);
      return null;
    }

    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || blob.type;
    const isHeic = /heic|heif/i.test(contentType) || HEIC_URL_PATTERN.test(url);
    if (isHeic) {
      try {
        let convertedBlob = await heic2any({
          blob,
          toType: 'image/jpeg',
          quality: 0.85,
        });
        if (Array.isArray(convertedBlob) && convertedBlob.length) convertedBlob = convertedBlob[0];
        return await blobToDataUrl(convertedBlob);
      } catch (convertError) {
        console.error('HEIC conversion failed:', convertError, url);
        // fallback: try to return the fetched blob as a data URL so html2canvas can include it
        try {
          return await blobToDataUrl(blob);
        } catch (e) {
          return null;
        }
      }
    }
    // For non-HEIC images, return a data URL to avoid CORS issues when rendering to canvas
    try {
      return await blobToDataUrl(blob);
    } catch (e) {
      console.error('Failed to convert image blob to data URL:', e, url);
      return url;
    }
  } catch (error) {
    console.error('Error converting image:', error, url);
    return url; // fallback
  }
};

// ---------- Main Component ----------
function CandidateInfo({ candidateId: candidateIdProp, suppressApiMessages = false }) {
  const { candidateId: candidateIdParam } = useParams();
  const candidateId = candidateIdProp || candidateIdParam;
  const navigate = useNavigate();

  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [newFront, setNewFront] = useState(null);
  const [newBack, setNewBack] = useState(null);
  const [ocrData, setOcrData] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  // Converted display URLs
  const [displayFront, setDisplayFront] = useState(null);
  const [displayBack, setDisplayBack] = useState(null);

  const fetchCandidate = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await recruiterAPI.getCandidateById(candidateId, { silent: suppressApiMessages });
      const candidateData = response.data?.data || response.data;
      const normalized = normalizeCandidate(candidateData);
      if (normalized) {
        setCandidate(normalized);
        fetchOcrData();
      } else {
        setError('Candidate not found');
      }
    } catch (err) {
      setError('Failed to load candidate details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [candidateId]);

  const fetchOcrData = async () => {
    setOcrLoading(true);
    try {
      const response = await recruiterAPI.getAadhaarOcrVerification(candidateId, { silent: suppressApiMessages });
      const data = normalizeOcrResponse(response);
      setOcrData(data);
    } catch (err) {
      console.error('Failed to load OCR data:', err);
      setOcrData(null);
    } finally {
      setOcrLoading(false);
    }
  };

  useEffect(() => {
    if (candidateId) {
      fetchCandidate();
    }
  }, [candidateId, fetchCandidate]);

  // Convert images when candidate URLs change
  useEffect(() => {
    if (candidate?.aadhaarFront) {
      getDisplayableImageUrl(candidate.aadhaarFront)
        .then((url) => setDisplayFront(url))
        .catch(() => setDisplayFront(candidate.aadhaarFront));
    } else {
      setDisplayFront(null);
    }
    if (candidate?.aadhaarBack) {
      getDisplayableImageUrl(candidate.aadhaarBack)
        .then((url) => setDisplayBack(url))
        .catch(() => setDisplayBack(candidate.aadhaarBack));
    } else {
      setDisplayBack(null);
    }
  }, [candidate?.aadhaarFront, candidate?.aadhaarBack]);

  // Cleanup blob URLs
  useEffect(() => {
    return () => {
      if (displayFront?.startsWith('blob:')) URL.revokeObjectURL(displayFront);
      if (displayBack?.startsWith('blob:')) URL.revokeObjectURL(displayBack);
    };
  }, [displayFront, displayBack]);

  const handleFileChange = (side) => (e) => {
    const file = e.target.files[0];
    if (file) {
      side === 'front' ? setNewFront(file) : setNewBack(file);
    }
  };

  const handleReupload = async () => {
    if (!newFront && !newBack) return;
    setUploading(true);

    try {
      if (newFront) {
        await recruiterAPI.uploadAadhaarFront(candidateId, newFront);
      }
      if (newBack) {
        await recruiterAPI.uploadAadhaarBack(candidateId, newBack);
      }
      setNewFront(null);
      setNewBack(null);
      await fetchCandidate();
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/app/recruiter/candidate-database');
    }
  };

  const contentRef = useRef(null);
  const headerRef = useRef(null);

  const handlePostCandidateId = async () => {
    if (!candidateId) return;
    setActionLoading(true);
    try {
      await recruiterAPI.postCandidateId(candidateId);
    } catch (err) {
      console.error('Failed to post candidate id', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportReport = async () => {
    if (!candidate || !contentRef.current) return;

    const element = contentRef.current;
    const headerElement = headerRef.current;
    const originalBg = element.style.backgroundColor;
    const originalHeaderDisplay = headerElement ? headerElement.style.display : '';

    element.style.backgroundColor = '#ffffff';
    if (headerElement) headerElement.style.display = 'none';

    try {
      const images = element.querySelectorAll('img');
      await Promise.all(
        Array.from(images).map(async (img) => {
          // Convert remote images to data URLs where possible to avoid CORS/tainting issues
          try {
            if (img.src && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
              const convertedSrc = await getDisplayableImageUrl(img.src);
              if (convertedSrc) img.src = convertedSrc;
            }
          } catch (e) {
            // ignore conversion errors per-image
            console.warn('Image conversion during export failed for', img.src, e);
          }

          return new Promise((resolve) => {
            if (img.complete) resolve();
            else {
              img.onload = resolve;
              img.onerror = resolve;
            }
          });
        })
      );

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowHeight: element.scrollHeight,
        imageTimeout: 15000,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pdfWidth;
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

      let position = 0;
      let pageCount = 0;

      while (position < imgHeight) {
        if (pageCount > 0) pdf.addPage();
        const yOffset = -position;
        pdf.addImage(imgData, 'JPEG', 0, yOffset, imgWidth, imgHeight);
        position += pdfHeight;
        pageCount++;
      }

      const fileName = `Candidate_Report_${candidate.name ? candidate.name.replace(/\s/g, '_') : 'Candidate'}_${candidateId}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('PDF export failed', err);
      alert('PDF export failed. Please try again.');
    } finally {
      element.style.backgroundColor = originalBg;
      if (headerElement) headerElement.style.display = originalHeaderDisplay;
    }
  };

  // -------- Render --------
  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <p>Loading candidate details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32 }}>
        <button className="btn btn-outline btn-sm" onClick={handleBack} style={{ marginBottom: 16 }}>
          <FontAwesomeIcon icon={faArrowLeft} /> Back
        </button>
        <Card style={{ padding: 32, textAlign: 'center', color: 'var(--red)' }}>{error}</Card>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div style={{ padding: 32 }}>
        <button className="btn btn-outline btn-sm" onClick={handleBack}>
          <FontAwesomeIcon icon={faArrowLeft} /> Back
        </button>
        <Card style={{ padding: 32, textAlign: 'center' }}>No candidate data available</Card>
      </div>
    );
  }

  const {
    name = 'Unknown',
    email = '—',
    mobile = '—',
    whatsapp = mobile,
    gender = '—',
    dob = '—',
    fatherName = '—',
    presentAddress = '—',
    permanentAddress = '—',
    aadhaarNumber = '—',
    profileImage = null,
    aadhaarFront = null,
    aadhaarBack = null,
    location = '—',
    education = '—',
    degree = '—',
    college = '—',
    completionYear = '—',
    currentStatus = '—',
    skills = [],
  } = candidate;

  // Helper to open the converted image in a new tab
  const openFullImage = (url) => {
    if (url) {
      window.open(url, '_blank');
    } else {
      alert('Image not available');
    }
  };

  return (
    <div
      ref={contentRef}
      data-export-root
      style={{
        padding: 24,
        paddingBottom: 40,
        maxWidth: '1400px',
        margin: '24px auto',
        backgroundColor: '#ffffff',
        borderRadius: 12,
      }}
    >
      {/* Header with actions */}
      <div
        ref={headerRef}
        data-export-header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}
      >
        <button
          className="btn btn-tertiary btn-sm"
          onClick={handleBack}
          style={{ gap: 8, display: 'flex', alignItems: 'center', color: 'var(--text2)' }}
        >
          <FontAwesomeIcon icon={faArrowLeft} /> Database
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={handlePostCandidateId} disabled={actionLoading}>
            <FontAwesomeIcon icon={faUpload} /> {actionLoading ? 'Sending...' : 'Send Candidate ID'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleExportReport}>
            <FontAwesomeIcon icon={faDownload} /> Export Report
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left Sidebar (unchanged) */}
        <aside style={{ display: 'grid', gap: 20 }}>
          <Card style={{ padding: 0, overflow: 'hidden', textAlign: 'center' }}>
            <div style={{ background: 'linear-gradient(135deg, #0E7C86 0%, #6C3FC5 100%)', height: 80 }} />
            <div style={{ marginTop: -50, padding: '0 20px 24px' }}>
              <div
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: '50%',
                  border: '4px solid white',
                  margin: '0 auto 16px',
                  background: '#f3f4f6',
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
              >
                {profileImage ? (
                  <img src={profileImage} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                    <FontAwesomeIcon icon={faUser} size="2x" />
                  </div>
                )}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 4px' }}>{name}</h2>
              <p style={{ color: 'var(--text3)', fontSize: 13, fontFamily: 'monospace', marginBottom: 16 }}>
                ID: {candidateId}
              </p>

              {ocrData ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 20,
                    backgroundColor: ocrData.success ? 'var(--green-light)' : 'rgba(255, 59, 48, 0.1)',
                    color: ocrData.success ? 'var(--green)' : 'var(--red)',
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  <FontAwesomeIcon icon={ocrData.success ? faCheckCircle : faTimesCircle} />
                  {ocrData.success ? 'Verified' : 'Verification Failed'}
                </div>
              ) : (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 20,
                    backgroundColor: 'var(--yellow-light)',
                    color: 'var(--saffron)',
                    fontSize: 12,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  <FontAwesomeIcon icon={faExclamationTriangle} />
                  Pending
                </div>
              )}
            </div>
          </Card>

          <Card style={{ padding: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text1)' }}>
              Contact Information
            </h4>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ color: 'var(--teal)', width: 16 }}>
                  <FontAwesomeIcon icon={faEnvelope} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Email Address</div>
                  <div style={{ fontSize: 13, fontWeight: 500, wordBreak: 'break-all' }}>{email}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ color: 'var(--teal)', width: 16 }}>
                  <FontAwesomeIcon icon={faPhone} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>
                    WhatsApp / Mobile
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    +91 {whatsapp} / +91 {mobile}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ color: 'var(--teal)', width: 16 }}>
                  <FontAwesomeIcon icon={faMapMarkerAlt} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Current Location</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{location}</div>
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ padding: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text1)' }}>
              Personal & Family
            </h4>
            <div style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ color: 'var(--teal)', width: 16 }}>
                  <FontAwesomeIcon icon={faUser} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Gender (Form)</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{gender}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ color: 'var(--teal)', width: 16 }}>
                  <FontAwesomeIcon icon={faInfoCircle} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Date of Birth</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {formatDate(dob)} ({calculateAge(dob)} yrs)
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ color: 'var(--teal)', width: 16 }}>
                  <FontAwesomeIcon icon={faUsers} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase' }}>Father's Name</div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{fatherName}</div>
                </div>
              </div>
            </div>
          </Card>

          <Card style={{ padding: 20 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: 'var(--text1)' }}>
              Address Details
            </h4>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Present
                </div>
                <div style={{ fontSize: 13, lineHeight: '1.5' }}>{presentAddress}</div>
              </div>
              <div style={{ height: 1, background: 'var(--border-light)' }} />
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Permanent
                </div>
                <div style={{ fontSize: 13, lineHeight: '1.5' }}>{permanentAddress}</div>
              </div>
            </div>
          </Card>
        </aside>

        {/* Right Main Column */}
        <main style={{ display: 'grid', gap: 24 }}>
          {/* Education & Employment Section */}
          <Card style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: 'rgba(108, 63, 197, 0.1)',
                  color: '#6C3FC5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                }}
              >
                <FontAwesomeIcon icon={faGraduationCap} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Education & Professional Details</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text3)' }}>
                  Current qualification and employment status
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Highest Education
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{education}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{degree}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>
                  College / Institution
                </div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{college}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>Passed in: {completionYear}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Current Status
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--teal)' }}>{currentStatus}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{skills.length} Skills listed</div>
              </div>
            </div>

            {skills.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Skills / Qualifications
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {skills.map((skill, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '4px 12px',
                        background: 'var(--bg-light)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Aadhaar OCR Verification */}
          <Card style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: 'rgba(14, 124, 134, 0.1)',
                    color: 'var(--teal)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                  }}
                >
                  <FontAwesomeIcon icon={faIdCard} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Aadhaar OCR Verification</h3>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text3)' }}>
                    Data extracted automatically from the DigiLocker documents
                  </p>
                </div>
              </div>
            </div>

            {ocrLoading ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>
                <p>Loading verification data...</p>
              </div>
            ) : ocrData ? (
              <>
                {ocrData.aadhaar_xml_data?.profile_image && (
                  <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'center' }}>
                    <div
                      style={{
                        width: 150,
                        height: 150,
                        borderRadius: 12,
                        overflow: 'hidden',
                        border: '2px solid var(--teal)',
                        boxShadow: '0 4px 12px rgba(14, 124, 134, 0.2)',
                      }}
                    >
                      <img
                        src={`data:image/jpeg;base64,${ocrData.aadhaar_xml_data.profile_image}`}
                        alt="Profile"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>
                )}

                <div
                  style={{
                    background: '#f8fafc',
                    borderRadius: 12,
                    padding: 20,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 24,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Full Name
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {ocrData.aadhaar_xml_data?.full_name || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Gender
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{ocrData.aadhaar_xml_data?.gender || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Date of Birth
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {formatDate(ocrData.aadhaar_xml_data?.dob)}
                      {ocrData.aadhaar_xml_data?.yob && (
                        <span style={{ color: 'var(--text3)', fontWeight: 400 }}>
                          {' '}
                          (YOB: {ocrData.aadhaar_xml_data.yob})
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Full Address
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>
                      {ocrData.aadhaar_xml_data?.full_address || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Zip Code
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{ocrData.aadhaar_xml_data?.zip || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Father / Guardian
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      {ocrData.aadhaar_xml_data?.father_name || ocrData.aadhaar_xml_data?.care_of || '—'}
                    </div>
                  </div>
                  <div style={{ gridColumn: 'span 3', height: 1, background: 'var(--border-light)' }} />
                  <div style={{ gridColumn: 'span 3' }}>
                    {ocrData.xml_url ? (
                      <a
                        href={ocrData.xml_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 14, fontWeight: 600, color: 'var(--teal)' }}
                      >
                        Open Aadhaar XML
                      </a>
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 600 }}>—</div>
                    )}
                  </div>
                  <div style={{ gridColumn: 'span 3' }}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Digilocker Client ID
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600, wordBreak: 'break-all' }}>
                      {ocrData.client_id || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Masked Aadhaar
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 1 }}>
                      {ocrData.aadhaar_xml_data?.masked_aadhaar || '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Care Of (Father/Guardian)
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{ocrData.aadhaar_xml_data?.care_of || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                      Mobile Number
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>
                      +91 {ocrData.digilocker_metadata?.mobile_number || '—'}
                    </div>
                  </div>

                  {ocrData.aadhaar_xml_data?.address && (
                    <>
                      <div style={{ gridColumn: 'span 3', height: 1, background: 'var(--border-light)' }} />
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                          State
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {ocrData.aadhaar_xml_data.address.state || '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                          District
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {ocrData.aadhaar_xml_data.address.dist || '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Pincode
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {ocrData.aadhaar_xml_data.address.po || '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Location
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {ocrData.aadhaar_xml_data.address.loc || '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Street/House
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          {ocrData.aadhaar_xml_data.address.house ||
                            ocrData.aadhaar_xml_data.address.street ||
                            '—'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Landmark
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>
                          {ocrData.aadhaar_xml_data.address.landmark || '—'}
                        </div>
                      </div>
                    </>
                  )}

                  {(ocrData.client_id || ocrData.aadhaar_xml_data?.uniqueness_id) && (
                    <>
                      <div style={{ gridColumn: 'span 3', height: 1, background: 'var(--border-light)' }} />
                      <div style={{ gridColumn: 'span 3' }}>
                        <div style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 4 }}>
                          Verification ID (Uniqueness ID)
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            fontFamily: 'monospace',
                            wordBreak: 'break-all',
                            color: 'var(--text2)',
                          }}
                        >
                          {ocrData.aadhaar_xml_data?.uniqueness_id || '—'}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {ocrData.success && (
                  <div
                    style={{
                      marginTop: 20,
                      padding: 12,
                      background: 'rgba(34, 197, 94, 0.1)',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      borderRadius: 8,
                      color: 'var(--green)',
                      fontSize: 13,
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <FontAwesomeIcon icon={faCheckCircle} />
                    {ocrData.message || 'Verification successful'}
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text3)' }}>
                <p>No OCR verification data available</p>
              </div>
            )}
          </Card>

          {/* Document Previews */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <Card style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Aadhaar Front</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label
                    className="btn btn-tertiary btn-sm"
                    style={{ padding: '2px 8px', fontSize: 11, cursor: 'pointer', margin: 0 }}
                  >
                    <FontAwesomeIcon icon={faUpload} /> {newFront ? 'Change' : 'Update'}
                    <input type="file" hidden onChange={handleFileChange('front')} accept="image/*,.heic,.heif" />
                  </label>
                  <button
                    className="btn btn-tertiary btn-sm"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => openFullImage(displayFront || aadhaarFront)}
                  >
                    View Full
                  </button>
                </div>
              </div>
              <div
                style={{
                  aspectRatio: '1.6',
                  backgroundColor: '#f1f5f9',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: '1px solid var(--border-light)',
                }}
              >
                {(displayFront || aadhaarFront) ? (
                  <img
                    src={displayFront || aadhaarFront}
                    alt="Aadhaar Front"
                    style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                    <FontAwesomeIcon icon={faCamera} size="2x" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 12 }}>Not Uploaded</div>
                  </div>
                )}
              </div>
              {newFront && <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 8 }}>Selected: {newFront.name}</div>}
            </Card>

            <Card style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Aadhaar Back</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <label
                    className="btn btn-tertiary btn-sm"
                    style={{ padding: '2px 8px', fontSize: 11, cursor: 'pointer', margin: 0 }}
                  >
                    <FontAwesomeIcon icon={faUpload} /> {newBack ? 'Change' : 'Update'}
                    <input type="file" hidden onChange={handleFileChange('back')} accept="image/*,.heic,.heif" />
                  </label>
                  <button
                    className="btn btn-tertiary btn-sm"
                    style={{ padding: '2px 8px', fontSize: 11 }}
                    onClick={() => openFullImage(displayBack || aadhaarBack)}
                  >
                    View Full
                  </button>
                </div>
              </div>
              <div
                style={{
                  aspectRatio: '1.6',
                  backgroundColor: '#f1f5f9',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: '1px solid var(--border-light)',
                }}
              >
                {(displayBack || aadhaarBack) ? (
                  <img
                    src={displayBack || aadhaarBack}
                    alt="Aadhaar Back"
                    style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                    <FontAwesomeIcon icon={faCamera} size="2x" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 12 }}>Not Uploaded</div>
                  </div>
                )}
              </div>
              {newBack && <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 8 }}>Selected: {newBack.name}</div>}
            </Card>
          </div>

          {(newFront || newBack) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn btn-primary" onClick={handleReupload} disabled={uploading}>
                <FontAwesomeIcon icon={faUpload} style={{ marginRight: 8 }} />
                {uploading ? 'Uploading...' : 'Upload New Documents'}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default CandidateInfo;