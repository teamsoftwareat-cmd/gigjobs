import { useEffect, useRef, useState } from 'react'
import { recruiterAPI } from '../../api/axios'

const API_ENDPOINTS = {
  verify: 'https://cynosurejobs.net/digilocker/core-team-attendance/assign_employee/get_candidate_face_image.php',
}

const styles = `
  :root {
    --bg: #0a1220;
    --panel: rgba(5, 10, 18, 0.7);
    --panel-strong: rgba(15, 28, 42, 0.9);
    --white: #ffffff;
    --muted: rgba(255, 255, 255, 0.72);
    --primary: #2f6ef7;
    --primary-soft: #edf3ff;
    --success: #1fab74;
    --danger: #d94d62;
    --shadow: 0 30px 55px rgba(0, 0, 0, 0.38);
  }

  * {
    box-sizing: border-box;
  }

  html, body {
    margin: 0;
    height: 100%;
    font-family: 'Inter', sans-serif;
    background: var(--bg);
    color: var(--white);
    overflow: hidden;
    overscroll-behavior: none;
  }

  body {
    min-height: 100vh;
    min-height: 100dvh;
  }

  button, input {
    font: inherit;
  }

  button {
    cursor: pointer;
  }

  .core-attendance-stage {
    position: relative;
    width: 100vw;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: #020812;
  }

  .core-attendance-stage video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: #020812;
    transform: scaleX(-1);
  }

  .core-captured-frame {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    background: #020812;
    transform: scaleX(1);
  }

  .core-scan-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    overflow: hidden;
    background: linear-gradient(rgba(47, 110, 247, 0.04), rgba(47, 110, 247, 0.04)), repeating-linear-gradient(0deg, transparent 0, transparent 7px, rgba(122, 166, 255, 0.06) 8px);
  }

  .core-scan-line {
    position: absolute;
    left: 8%;
    right: 8%;
    top: 18%;
    height: 3px;
    background: #79a6ff;
    box-shadow: 0 0 10px 3px rgba(91, 141, 255, 0.8), 0 0 34px 8px rgba(47, 110, 247, 0.42);
    animation: core-scan-sweep 1.8s ease-in-out infinite;
  }

  .core-scan-frame {
    position: absolute;
    left: 50%;
    top: 46%;
    width: min(70vw, 360px);
    height: min(58vh, 430px);
    transform: translate(-50%, -50%);
    border: 1px solid rgba(146, 190, 255, 0.28);
    box-shadow: 0 0 0 999px rgba(2, 8, 18, 0.1), inset 0 0 24px rgba(87, 145, 255, 0.08);
  }

  .core-scan-frame::before,
  .core-scan-frame::after {
    content: '';
    position: absolute;
    inset: -1px;
    pointer-events: none;
  }

  .core-scan-frame::before {
    width: 44px;
    height: 44px;
    border-top: 3px solid #92beff;
    border-left: 3px solid #92beff;
    clip-path: none;
    filter: drop-shadow(0 0 6px rgba(121, 166, 255, 0.9));
  }

  .core-scan-frame::after {
    width: 44px;
    height: 44px;
    inset: auto 0 0 auto;
    border-right: 3px solid #92beff;
    border-bottom: 3px solid #92beff;
    clip-path: none;
    filter: drop-shadow(0 0 6px rgba(121, 166, 255, 0.9));
  }

  .core-scan-corner {
    position: absolute;
    width: 44px;
    height: 44px;
    border-color: #92beff;
    border-style: solid;
    filter: drop-shadow(0 0 6px rgba(121, 166, 255, 0.9));
  }

  .core-scan-corner.top-right {
    top: -1px;
    right: -1px;
    border-width: 3px 3px 0 0;
  }

  .core-scan-corner.bottom-left {
    bottom: -1px;
    left: -1px;
    border-width: 0 0 3px 3px;
  }

  .core-scan-status {
    position: absolute;
    left: 50%;
    bottom: 18%;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 13px;
    border: 1px solid rgba(146, 190, 255, 0.36);
    border-radius: 999px;
    background: rgba(2, 8, 18, 0.68);
    color: white;
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    backdrop-filter: blur(8px);
  }

  .core-scan-status::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #79a6ff;
    box-shadow: 0 0 0 4px rgba(121, 166, 255, 0.16), 0 0 12px #79a6ff;
    animation: core-scan-pulse 1s ease-in-out infinite;
  }

  @keyframes core-scan-sweep {
    0%, 100% {
      top: 18%;
      opacity: 0.7;
    }
    50% {
      top: 78%;
      opacity: 1;
    }
  }

  @keyframes core-scan-pulse {
    50% {
      opacity: 0.38;
      transform: scale(0.78);
    }
  }

  .core-attendance-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 18px 18px 92px;
    background: linear-gradient(180deg, rgba(5, 10, 18, 0.44), rgba(5, 10, 18, 0.14) 38%, rgba(5, 10, 18, 0.72));
  }

  .core-top-bar {
    display: flex;
    justify-content: flex-start;
  }

  .core-brand-pill {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    border-radius: 999px;
    background: rgba(15, 28, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .core-brand-mark {
    width: 24px;
    height: 24px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, var(--primary), #5c8aff);
    color: white;
    font-weight: 800;
    font-size: 0.8rem;
  }

  .core-type-picker {
    display: flex;
    justify-content: center;
    margin-top: 8px;
  }

  .core-question-screen {
    width: 100vw;
    min-height: 100vh;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 24px;
    background: radial-gradient(circle at top, #19335a 0%, var(--bg) 48%, #020812 100%);
  }

  .core-question-card {
    width: min(100%, 460px);
    padding: 28px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 28px;
    background: rgb(88 88 88 / 77%);
    box-shadow: var(--shadow);
    text-align: center;
  }

  .core-question-card .core-brand-pill {
    margin-bottom: 30px;
  }

  .core-question-card h1 {
    margin: 0;
    font-size: clamp(1.8rem, 6vw, 2.5rem);
    line-height: 1.1;
    letter-spacing: -0.04em;
  }

  .core-question-card p {
    margin: 12px 0 24px;
    color: var(--muted);
    line-height: 1.5;
  }

  .core-question-options {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .core-detail-card {
    width: min(100%, 540px);
    padding: 28px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 28px;
    background: rgb(88 88 88 / 77%);
    box-shadow: var(--shadow);
  }

  .core-detail-card h2 {
    margin: 0 0 8px;
    font-size: clamp(1.8rem, 5vw, 2.6rem);
    letter-spacing: -0.04em;
  }

  .core-detail-card p {
    margin: 0 0 20px;
    color: var(--muted);
    line-height: 1.5;
  }

  .core-detail-form {
    display: grid;
    gap: 18px;
  }

  .core-form-field {
    display: grid;
    gap: 8px;
    text-align: left;
  }

  .core-form-label {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.72);
  }

  .core-searchable-select {
    position: relative;
  }

  .core-searchable-trigger {
    width: 100%;
    min-height: 52px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.045));
    color: white;
    padding: 12px 14px;
    font-size: 0.96rem;
    text-align: left;
    cursor: pointer;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 24px rgba(0,0,0,0.12);
    backdrop-filter: blur(16px) saturate(135%);
    -webkit-backdrop-filter: blur(16px) saturate(135%);
    transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
  }

  .core-searchable-trigger:hover:not(:disabled) {
    border-color: rgba(146,190,255,0.45);
    background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06));
  }

  .core-searchable-trigger:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }

  .core-searchable-trigger:focus-visible {
    outline: none;
    border-color: rgba(122, 166, 255, 0.8);
    box-shadow: 0 0 0 3px rgba(122, 166, 255, 0.18);
  }

  .core-searchable-panel {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    z-index: 12;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 16px;
    background: rgba(6, 14, 24, 0.96);
    box-shadow: 0 20px 30px rgba(0, 0, 0, 0.28);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 280px;
  }

  .core-searchable-input {
    width: 100%;
    min-height: 48px;
    border: 0;
    border-bottom: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.08);
    color: white;
    padding: 12px 14px;
    font-size: 0.95rem;
    backdrop-filter: blur(14px) saturate(130%);
    -webkit-backdrop-filter: blur(14px) saturate(130%);
  }

  .core-searchable-input:focus {
    outline: none;
    background: rgba(255,255,255,0.13);
  }

  .core-manual-input {
    width: 100%;
    min-height: 52px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.045));
    color: white;
    padding: 12px 14px;
    font-size: 0.96rem;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 10px 24px rgba(0,0,0,0.12);
  }

  .core-manual-input:focus {
    outline: none;
    border-color: rgba(122, 166, 255, 0.8);
    box-shadow: 0 0 0 3px rgba(122, 166, 255, 0.18);
  }

  .core-manual-input::placeholder {
    color: rgba(255,255,255,0.52);
  }

  .core-searchable-list {
    overflow: auto;
    max-height: 220px;
    background: rgba(6, 14, 24, 0.96);
  }

  .core-searchable-option {
    width: 100%;
    border: 0;
    background: transparent;
    color: white;
    text-align: left;
    padding: 12px 14px;
    cursor: pointer;
    font-size: 0.95rem;
    display: block;
  }

  .core-searchable-option:hover,
  .core-searchable-option:focus-visible {
    background: rgba(47, 110, 247, 0.14);
    outline: none;
  }

  .core-select {
    width: 100%;
    min-height: 52px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 14px;
    background: rgba(255,255,255,0.04);
    color: white;
    padding: 12px 14px;
    font-size: 0.96rem;
  }

  .core-select option {
    color: #0b1523;
  }

  .core-form-actions {
    display: flex;
    gap: 12px;
    margin-top: 4px;
  }

  .core-secondary-btn,
  .core-primary-btn {
    flex: 1;
    min-height: 52px;
  }

  .core-question-option {
    min-height: 118px;
    display: grid;
    place-items: center;
    gap: 8px;
    padding: 18px 12px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.06);
    color: white;
    transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
  }

  .core-question-option:hover,
  .core-question-option:focus-visible {
    border-color: rgba(122, 166, 255, 0.75);
    background: rgba(47, 110, 247, 0.2);
    transform: translateY(-2px);
    outline: none;
  }

  .core-question-icon {
    font-size: 1.8rem;
  }

  .core-question-option strong {
    font-size: 1rem;
  }

  .core-question-option span:last-child {
    color: var(--muted);
    font-size: 0.78rem;
  }

  .core-picker-shell {
    display: inline-flex;
    gap: 8px;
    padding: 8px;
    border-radius: 999px;
    background: rgba(15, 28, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    box-shadow: 0 16px 30px rgba(0, 0, 0, 0.18);
  }

  .core-picker-option {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: rgba(255,255,255,0.82);
    font-weight: 700;
    transition: all 0.2s ease;
  }

  .core-picker-option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .core-picker-option.active {
    background: rgba(47, 110, 247, 0.18);
    color: white;
    box-shadow: inset 0 0 0 1px rgba(122, 166, 255, 0.4);
  }

  .core-picker-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.6);
    background: transparent;
    display: inline-block;
  }

  .core-picker-option.active .core-picker-dot {
    background: white;
    border-color: white;
    box-shadow: 0 0 0 2px rgba(255,255,255,0.2);
  }

  .core-status-box {
    max-width: 360px;
    margin: 0 auto;
  }

  .core-eyebrow {
    margin: 0 0 8px;
    text-align: left;
    color: var(--muted);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .core-status-box h1 {
    text-align: center;
    margin: 0;
    max-width: 240px;
    font-size: clamp(1.3rem, 5vw, 2.2rem);
    line-height: 1.1;
    letter-spacing: -0.05em;
    margin-inline: auto;
  }

  .core-capture-bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 18px 20px 22px;
    background: linear-gradient(180deg, rgba(5, 10, 18, 0), rgba(5, 10, 18, 0.82));
  }

  .core-capture-btn,
  .core-primary-btn,
  .core-secondary-btn,
  .core-mark-again-btn {
    min-height: 56px;
    border: none;
    border-radius: 16px;
    font-weight: 700;
  }

  .core-capture-btn {
    display: block;
    width: 100%;
    background: linear-gradient(135deg, var(--primary), #5c8aff);
    color: white;
    font-size: 1rem;
    box-shadow: 0 24px 38px rgba(47, 110, 247, 0.28);
  }

  .core-success-screen {
    position: fixed;
    inset: 0;
    display: none;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(5, 10, 18, 0.72);
    z-index: 100;
  }

  .core-success-screen.open {
    display: flex;
  }

  .core-retake-screen {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(5, 10, 18, 0.72);
  }

  .core-retake-dialog {
    width: min(100%, 360px);
    padding: 24px 20px 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    background: rgba(12, 23, 36, 0.96);
    color: white;
    text-align: center;
    box-shadow: var(--shadow);
  }

  .core-retake-badge {
    width: 58px;
    height: 58px;
    display: grid;
    place-items: center;
    margin: 0 auto 14px;
    border-radius: 50%;
    background: rgba(217, 77, 98, 0.14);
    color: #ff9aaa;
    font-size: 28px;
    font-weight: 800;
  }

  .core-retake-dialog h2 {
    margin: 0 0 8px;
    font-size: 1.35rem;
  }

  .core-retake-dialog p {
    margin: 0 0 20px;
    color: var(--muted);
    line-height: 1.5;
  }

  .core-retake-btn {
    width: 100%;
    min-height: 52px;
    border: 0;
    border-radius: 14px;
    background: linear-gradient(135deg, var(--primary), #5c8aff);
    color: white;
    font-weight: 800;
  }

  .core-success-shell {
    width: min(100%, 520px);
    max-height: calc(100dvh - 28px);
    background: rgba(12, 23, 36, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 28px;
    padding: 18px 18px 20px;
    box-shadow: var(--shadow);
    overflow: hidden;
  }

  .core-photo-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 18px;
  }

  .core-photo-circle {
    width: 142px;
    height: 142px;
    border: 4px solid rgba(47, 110, 247, 0.18);
    border-radius: 50%;
    box-shadow: 0 18px 28px rgba(47, 110, 247, 0.12);
    overflow: hidden;
    background: linear-gradient(135deg, #dfebff, #bfd4ff);
  }

  .core-photo-circle img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .core-brand-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 22px;
  }

  .core-brand-pill {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.9);
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .core-brand-mark {
    width: 22px;
    height: 22px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #5c8aff, var(--primary));
    color: white;
    font-weight: 800;
    font-size: 0.72rem;
  }

  .core-status-badge {
    padding: 8px 12px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    background: rgba(28, 167, 115, 0.12);
    color: #74e2b3;
    border: 1px solid rgba(116, 226, 179, 0.25);
  }

  .core-identity-card {
    background: linear-gradient(180deg, #f5f9ff 0%, #edf4ff 100%);
    border-radius: 24px;
    padding: 18px 14px 14px;
    color: #0d1a2b;
    border: 1px solid rgba(13, 26, 43, 0.08);
  }

  .core-card-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 18px;
  }

  .core-profile-avatar {
    width: 62px;
    height: 62px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    background: linear-gradient(135deg, #dfeaff, #bfd3ff);
    color: #1d57d0;
    font-weight: 800;
    font-size: 1.2rem;
  }

  .core-title-block h1 {
    margin: 0;
    font-size: clamp(1.5rem, 5vw, 2rem);
    line-height: 1.15;
    letter-spacing: -0.04em;
  }

  .core-title-block p {
    margin: 4px 0 0;
    color: #5d7088;
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .core-card-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;
    margin: 14px 0 12px;
  }

  .core-field {
    border: 1px solid rgba(13, 26, 43, 0.08);
    background: rgba(255,255,255,0.28);
    border-radius: 14px;
    padding: 10px 12px;
  }

  .core-field-label {
    display: block;
    margin-bottom: 4px;
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #5d7088;
  }

  .core-field-value {
    font-size: 1.28rem;
    font-weight: 700;
    color: #0d1a2b;
  }

  .core-summary-note {
    margin: 0 0 18px;
    color: #5d7088;
    line-height: 1.5;
    font-size: 1.28rem;
  }

  .core-message-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(13, 26, 43, 0.08);
    margin: 18px 0 0;
    font-size: 1.28rem;
    line-height: 1.55;
    font-weight: 600;
  }

  .core-message-banner p {
    margin: 0;
    color: inherit;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .core-message-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 5px 9px;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .core-message-banner.checkin {
    background: rgba(28, 167, 115, 0.1);
    color: #0d6d48;
    border-color: rgba(28, 167, 115, 0.18);
  }

  .core-message-banner.checkin .core-message-pill {
    background: rgba(28, 167, 115, 0.14);
    color: #0c7d56;
  }

  .core-message-banner.checkout {
    background: rgba(47, 110, 247, 0.1);
    color: #184cb7;
    border-color: rgba(47, 110, 247, 0.18);
  }

  .core-message-banner.checkout .core-message-pill {
    background: rgba(47, 110, 247, 0.12);
    color: #2857d8;
  }

  .core-message-banner.completed {
    background: rgba(217, 77, 98, 0.08);
    color: #8a2438;
    border-color: rgba(217, 77, 98, 0.16);
  }

  .core-message-banner.completed .core-message-pill {
    background: rgba(217, 77, 98, 0.12);
    color: #a32d47;
  }

  .core-action-row {
    margin-top: 18px;
  }

  .core-success-screen .core-primary-btn {
    width: 100%;
    background: linear-gradient(135deg, var(--primary), #5c8aff);
    color: white;
    box-shadow: 0 18px 28px rgba(47, 110, 247, 0.2);
  }

  .core-primary-btn {
    background: linear-gradient(135deg, var(--primary), #5c8aff);
    color: white;
    box-shadow: 0 18px 28px rgba(47, 110, 247, 0.2);
  }

  .core-secondary-btn {
    background: #edf2ff;
    color: var(--primary);
  }

  @media (max-width: 420px) {
    .core-question-card {
      padding: 22px 16px;
    }

    .core-question-options {
      grid-template-columns: 1fr;
    }

    .core-attendance-overlay {
      padding: 16px 14px 88px;
    }

    .core-capture-bar {
      padding: 12px 14px 16px;
    }

    .core-status-box {
      margin: 0 auto;
      max-width: 260px;
    }

    .core-capture-btn,
    .core-primary-btn,
    .core-secondary-btn,
    .core-mark-again-btn {
      min-height: 52px;
      border-radius: 14px;
    }

    .core-success-shell {
      width: min(100%, 420px);
      padding: 14px 12px 16px;
    }

    .core-brand-row {
      margin-bottom: 14px;
    }

    .core-photo-circle {
      width: 110px;
      height: 110px;
    }

    .core-card-header {
      gap: 12px;
      margin-bottom: 14px;
    }

    .core-profile-avatar {
      width: 52px;
      height: 52px;
      border-radius: 14px;
    }

    .core-title-block h1 {
      font-size: 1.3rem;
    }

    .core-card-grid {
      grid-template-columns: 1fr;
    }

  }
`

const getInitials = (name = '') =>
  String(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'AR'

const dataURLToBlob = (dataUrl) => {
  const [header, data] = dataUrl.split(',')
  const mimeMatch = header.match(/data:(.*?);base64/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/png'
  const binary = atob(data)
  const array = new Uint8Array(binary.length)

  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i)
  }

  return new Blob([array], { type: mime })
}

const getCurrentLocation = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('Geolocation is not supported by this browser.'))
    return
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      })
    },
    (error) => {
      reject(error)
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
  )
})

const getDeviceInfo = () => JSON.stringify({
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  language: navigator.language,
  screen: `${window.screen.width}x${window.screen.height}`,
  viewport: `${window.innerWidth}x${window.innerHeight}`,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
})

const getIpAddress = async () => {
  try {
    const response = await fetch('https://api.ipify.org?format=json')
    if (!response.ok) return ''
    const result = await response.json()
    return result?.ip || ''
  } catch (error) {
    console.warn('Unable to resolve public IP address.', error)
    return ''
  }
}

const getAttendanceMessageState = (message = '') => {
  const normalized = String(message).toLowerCase()

  if (normalized.includes('check-in') || normalized.includes('check in')) {
    return { variant: 'checkin', label: 'Check-in' }
  }

  if (normalized.includes('check-out') || normalized.includes('check out') || normalized.includes('checkout')) {
    return { variant: 'checkout', label: 'Check-out' }
  }

  if (normalized.includes('already completed') || normalized.includes('already marked') || normalized.includes('already checked')) {
    return { variant: 'completed', label: 'Completed' }
  }

  return { variant: 'checkin', label: 'Verified' }
}

const normalizeProjectId = (value) => String(value ?? '').trim().replace(/^proj_/i, '')
const normalizeAttendanceProjectType = (value) => (
  String(value ?? '').trim().toLowerCase().includes('written') ? 'Written' : 'Regular'
)
const STATIC_PROJECT_OPTIONS = [
  { id: 'Home', name: 'Home', projectType: 'Regular', fixedLocation: 'Home' },
  { id: 'Travel', name: 'Travel', projectType: 'Regular', fixedLocation: 'Travel' },
]

const normalizeProjectOption = (item) => {
  if (!item) return null

  if (typeof item === 'string') {
    const text = item.trim()
    return text ? { id: normalizeProjectId(text), name: text } : null
  }

  const id = normalizeProjectId(item.id ?? item.project_id ?? item.projectId ?? item.value ?? item.key ?? item._id)
  const projectCode = normalizeProjectId(item.projectId ?? item.project_id ?? item.project ?? item.projectCode)
  const name = String(item.projectName ?? item.project_name ?? item.name ?? item.title ?? item.label ?? item.project ?? '').trim()

  if (!id && !name && !projectCode) return null

  return {
    id: id || projectCode || name,
    name: name || projectCode || id,
    projectType: item.projectType ?? item.type ?? item.project_type ?? item.projectKind ?? item.kind ?? item.project_kind ?? '',
    location: item.location ?? item.location_name ?? item.locationName ?? '',
    projectCode,
  }
}

const getProjectListFromResponse = (payload) => {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.items)) return payload.items
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

export default function CoreAttendance() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [attendanceType, setAttendanceType] = useState('travel')
  const [hasStarted, setHasStarted] = useState(false)
  const [statusText, setStatusText] = useState('Position your face in the frame')
  const [capturedImageDataUrl, setCapturedImageDataUrl] = useState('')
  const [responseMessage, setResponseMessage] = useState('')
  const [messageState, setMessageState] = useState({ variant: 'checkin', label: 'Verified' })
  const [verifiedEmployee, setVerifiedEmployee] = useState(null)
  const [successOpen, setSuccessOpen] = useState(false)
  const [retakeOpen, setRetakeOpen] = useState(false)
  const [captureBusy, setCaptureBusy] = useState(false)
  const [cameraStarted, setCameraStarted] = useState(false)
  const [projectOptions, setProjectOptions] = useState([])
  const [projectQuery, setProjectQuery] = useState('')
  const [projectOptionsOpen, setProjectOptionsOpen] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedProjectName, setSelectedProjectName] = useState('')
  const [selectedProjectType, setSelectedProjectType] = useState('')
  const [manualProjectName, setManualProjectName] = useState('')
  const [locationOptions, setLocationOptions] = useState([])
  const [districtOptions, setDistrictOptions] = useState([])
  const [areaQuery, setAreaQuery] = useState('')
  const [areaOptionsOpen, setAreaOptionsOpen] = useState(false)
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedDistrictId, setSelectedDistrictId] = useState('')
  const [manualAreaName, setManualAreaName] = useState('')

  const isManualProject = selectedProjectId === '__manual__'
  const fixedProjectLocation = STATIC_PROJECT_OPTIONS.find((project) => project.id === selectedProjectId)?.fixedLocation || ''
  const isFixedProject = Boolean(fixedProjectLocation)

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await recruiterAPI.getProjects({ limit: 1000 })
        const payload = response?.data ?? {}
        const rawList = getProjectListFromResponse(payload)
        const list = rawList
          .map((item) => normalizeProjectOption(item))
          .filter(Boolean)
        setProjectOptions(list)
      } catch (error) {
        console.warn('Unable to load projects for attendance:', error)
        setProjectOptions([])
      }
    }

    loadProjects()
  }, [])

  useEffect(() => {
    if (!selectedProjectId || isManualProject || isFixedProject) {
      setLocationOptions([])
      setDistrictOptions([])
      setSelectedLocationId(fixedProjectLocation)
      setSelectedDistrictId('')
      setAreaQuery('')
      setAreaOptionsOpen(false)
      setSelectedProjectType(isManualProject || isFixedProject ? 'Regular' : '')
      return
    }

    const project = projectOptions.find((item) => String(item.id) === String(selectedProjectId)) || null
    const projectType = normalizeAttendanceProjectType(project?.projectType || project?.type || project?.project_type)
    const isWrittenProject = projectType === 'Written'

    setSelectedProjectType(projectType)

    let active = true

    const loadMeta = async () => {
      try {
        if (isWrittenProject) {
          const response = await recruiterAPI.getProjectDistricts(selectedProjectId)
          const payload = response?.data ?? {}
          const rawList = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.districts) ? payload.districts : []
          const list = rawList
            .map((item) => {
              if (item && typeof item === 'object') {
                return {
                  id: String(item.id ?? item.districtId ?? item.locationId ?? item.value ?? ''),
                  name: String(item.name ?? item.district ?? item.location ?? item.label ?? ''),
                }
              }
              return { id: String(item), name: String(item) }
            })
            .filter((item) => item.id && item.name)

          if (active) {
            setLocationOptions([])
            setDistrictOptions(list)
            setAreaQuery('')
            setAreaOptionsOpen(false)
          }
          return
        }

        const response = await recruiterAPI.getProjectLocations(selectedProjectId)
        const payload = response?.data ?? {}
        const rawList = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.locations) ? payload.locations : []
        const list = rawList
          .map((item) => {
            if (item && typeof item === 'object') {
              return {
                id: String(item.id ?? item.locationId ?? item.value ?? ''),
                name: String(item.name ?? item.location ?? item.label ?? ''),
              }
            }
            return { id: String(item), name: String(item) }
          })
          .filter((item) => item.id && item.name)

        if (active) {
          setLocationOptions(list)
          setDistrictOptions([])
          setAreaQuery('')
          setAreaOptionsOpen(false)
        }
      } catch (error) {
        console.warn('Unable to load project meta for attendance:', error)
        if (active) {
          setLocationOptions([])
          setDistrictOptions([])
          setAreaQuery('')
          setAreaOptionsOpen(false)
        }
      }
    }

    loadMeta()

    return () => {
      active = false
    }
  }, [fixedProjectLocation, isFixedProject, isManualProject, projectOptions, selectedProjectId])

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const openCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setStatusText('This browser does not support live camera capture.')
      return
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setStatusText('Position your face in the frame')
    } catch (error) {
      console.error('Camera access failed:', error)
      setStatusText('Camera access was blocked. Please allow access and try again.')
    }
  }

  const pauseCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
  }

  const handleTypeChange = (event) => {
    setAttendanceType(event.target.value)
  }

  const beginAttendance = async (type) => {
    setAttendanceType(type)
    setHasStarted(true)
    setCameraStarted(false)
    setStatusText('Select a project and location to continue')
  }

  const returnToAttendanceType = () => {
    setHasStarted(false)
    setSelectedProjectId('')
    setSelectedProjectName('')
    setSelectedProjectType('')
    setManualProjectName('')
    setSelectedLocationId('')
    setSelectedDistrictId('')
    setLocationOptions([])
    setDistrictOptions([])
    setProjectQuery('')
    setAreaQuery('')
    setManualAreaName('')
    setProjectOptionsOpen(false)
    setAreaOptionsOpen(false)
  }

  const allProjectOptions = attendanceType === 'travel'
    ? STATIC_PROJECT_OPTIONS
    : projectOptions.filter((project) => (
      !STATIC_PROJECT_OPTIONS.some((staticProject) => project.name.toLowerCase() === staticProject.name.toLowerCase())
    ))

  const filteredProjectOptions = projectQuery.trim()
    ? allProjectOptions.filter((project) => {
      const text = `${project.name} ${project.id}`.toLowerCase()
      return text.includes(projectQuery.trim().toLowerCase())
    })
    : allProjectOptions

  const areaOptions = String(selectedProjectType || '').toLowerCase().includes('written')
    ? districtOptions
    : locationOptions

  const filteredAreaOptions = areaQuery.trim()
    ? areaOptions.filter((option) => option.name.toLowerCase().includes(areaQuery.trim().toLowerCase()))
    : areaOptions

  const handleProjectSelect = (project) => {
    setSelectedProjectId(String(project.id))
    setSelectedProjectName(project.name)
    setManualProjectName('')
    setProjectQuery(project.name)
    setProjectOptionsOpen(false)
    setSelectedLocationId(project.fixedLocation || '')
    setSelectedDistrictId('')
    setAreaQuery('')
    setManualAreaName('')
    setAreaOptionsOpen(false)
  }

  const handleManualProjectSelect = () => {
    setSelectedProjectId('__manual__')
    setSelectedProjectName('')
    setManualProjectName('')
    setProjectQuery('')
    setProjectOptionsOpen(false)
    setSelectedLocationId('')
    setSelectedDistrictId('')
    setAreaQuery('')
    setManualAreaName('')
    setAreaOptionsOpen(false)
  }

  const handleAreaSelect = (option) => {
    if (String(selectedProjectType || '').toLowerCase().includes('written')) {
      setSelectedDistrictId(String(option.id))
    } else {
      setSelectedLocationId(String(option.id))
    }
    setAreaQuery(option.name)
    setAreaOptionsOpen(false)
  }

  const continueToCamera = async () => {
    if (!selectedProjectId) {
      setStatusText('Please select a project first.')
      return
    }

    if (isManualProject && !manualProjectName.trim()) {
      setStatusText('Please enter a project name.')
      return
    }

    const isWrittenProject = String(selectedProjectType || '').toLowerCase().includes('written')

    if (isWrittenProject && !selectedDistrictId && !isManualProject) {
      setStatusText('Please select a district for this project.')
      return
    }

    if (!isWrittenProject && !selectedLocationId && !isManualProject) {
      setStatusText('Please select a location for this project.')
      return
    }

    if (isManualProject && !manualAreaName.trim()) {
      setStatusText(`Please enter a ${isWrittenProject ? 'district' : 'location'}.`)
      return
    }

    setStatusText('Position your face in the frame')
    setCameraStarted(true)
    await openCamera()
  }

  const handleCapture = async () => {
    if (!videoRef.current || !videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      setStatusText('Camera is not ready yet. Please allow access and try again.')
      return
    }

    setCaptureBusy(true)
    setStatusText('Verifying face...')

    try {
      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight

      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Canvas context unavailable')
      }

      context.translate(canvas.width, 0)
      context.scale(-1, 1)
      context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
      const imageDataUrl = canvas.toDataURL('image/png')
      setCapturedImageDataUrl(imageDataUrl)
      pauseCamera()

      const formData = new FormData()
      formData.append('image', dataURLToBlob(imageDataUrl), 'attendance-capture.png')
      formData.append('action', 'attendance')
      formData.append('attendance_type', attendanceType)
      formData.append('project_id', isManualProject ? '' : selectedProjectId)
      formData.append('project_name', isManualProject ? manualProjectName.trim() : selectedProjectName || '')
      formData.append('project_type', selectedProjectType || '')
      formData.append('location', isManualProject ? manualAreaName.trim() : fixedProjectLocation || selectedLocationId || '')
      formData.append('district', isManualProject ? manualAreaName.trim() : selectedDistrictId || '')
      formData.append('device_info', getDeviceInfo())
      formData.append('time', new Date().toISOString())

      const ipAddress = await getIpAddress()
      formData.append('ip_address', ipAddress)

      let coordinates = null
      try {
        coordinates = await getCurrentLocation()
        formData.append('lat', String(coordinates.latitude))
        formData.append('long', String(coordinates.longitude))
      } catch (locationError) {
        console.warn('Location unavailable during capture.', locationError)
      }

      const response = await fetch(API_ENDPOINTS.verify, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`Verification failed with status ${response.status}`)
      }

      const result = await response.json().catch(() => ({}))
      const backendMessage = result?.message || result?.result?.message || ''
      const nextMessageState = getAttendanceMessageState(backendMessage)
      setResponseMessage(backendMessage)
      setMessageState(nextMessageState)
      const isFaceMatched = result?.success === true || result?.match === true || result?.face_match === true

      if (!isFaceMatched) {
        setStatusText(backendMessage || 'Face not matched.')
        setRetakeOpen(true)
        return
      }

      const employee = {
        id: result?.candidate_id || result?.employee_id || result?.employee?.id || 'N/A',
        name: result?.employee?.name || result?.name || 'Employee',
        role: result?.employee?.role || result?.role || 'Employee',
        action: result?.action || 'checkin',
        timestamp: result?.timestamp || new Date().toISOString(),
      }

      setVerifiedEmployee(employee)
      setStatusText(backendMessage || 'Attendance marked successfully.')
      setSuccessOpen(true)
    } catch (error) {
      console.error('Face verification API failed:', error)
      setStatusText('Unable to verify face.')
      setRetakeOpen(true)
    } finally {
      setCaptureBusy(false)
    }
  }

  const resetToCamera = async () => {
    setSuccessOpen(false)
    setVerifiedEmployee(null)
    setCapturedImageDataUrl('')
    setResponseMessage('')
    setCameraStarted(false)
    setStatusText('Select a project and location to continue')
  }

  const retakeCapture = async () => {
    setRetakeOpen(false)
    setCapturedImageDataUrl('')
    setResponseMessage('')
    setStatusText('Position your face in the frame')
    setCameraStarted(true)
    await openCamera()
  }

  const time = verifiedEmployee?.timestamp ? new Date(verifiedEmployee.timestamp) : new Date()
  const formattedTime = time.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (!hasStarted) {
    return (
      <>
        <style>{styles}</style>
        <main className="core-question-screen">
          <section className="core-question-card" aria-labelledby="core-question-title">
            <div className="core-brand-pill">
              <span className="core-brand-mark">C</span>
              <span>Attendance</span>
            </div>
            <p className="core-eyebrow">Before we begin</p>
            <h1 id="core-question-title">What are you attending for?</h1>
            <p>Choose an attendance type to continue to face verification.</p>
            <div className="core-question-options">
              <button type="button" className="core-question-option" onClick={() => beginAttendance('travel')}>
                <span className="core-question-icon" aria-hidden="true">&#8599;</span>
                <strong>Travel / Home</strong>
                <span>Field or travel work</span>
              </button>
              <button type="button" className="core-question-option" onClick={() => beginAttendance('project')}>
                <span className="core-question-icon" aria-hidden="true">&#9633;</span>
                <strong>Project</strong>
                <span>Project-based work</span>
              </button>
            </div>
          </section>
        </main>
      </>
    )
  }

  if (!cameraStarted) {
    const isWrittenProject = String(selectedProjectType || '').toLowerCase().includes('written')
    const selectedAreaLabel = isFixedProject
      ? fixedProjectLocation
      : isWrittenProject
      ? districtOptions.find((option) => String(option.id) === String(selectedDistrictId))?.name || 'Select district'
      : locationOptions.find((option) => String(option.id) === String(selectedLocationId))?.name || 'Select location'

    return (
      <>
        <style>{styles}</style>
        <main className="core-question-screen">
          <section className="core-detail-card" aria-labelledby="core-detail-title">
            <div className="core-brand-pill">
              <span className="core-brand-mark">C</span>
              <span>Attendance</span>
            </div>
            <p className="core-eyebrow">Attendance details</p>
            <h2 id="core-detail-title">Select your project</h2>
            <p>Choose the project and {isWrittenProject ? 'district' : 'location'} before capturing your face.</p>

            <div className="core-detail-form">
              <div className="core-form-field">
                <label className="core-form-label" htmlFor="core-project-search">Project</label>
                <div className="core-searchable-select">
                  <button
                    id="core-project-search"
                    type="button"
                    className="core-searchable-trigger"
                    onClick={() => setProjectOptionsOpen((prev) => !prev)}
                    aria-expanded={projectOptionsOpen}
                  >
                    <span>{isManualProject ? 'Other (type manually)' : selectedProjectName || 'Select project'}</span>
                    <span aria-hidden="true">{projectOptionsOpen ? '▴' : '▾'}</span>
                  </button>

                  {projectOptionsOpen ? (
                    <div className="core-searchable-panel" role="listbox">
                      <input
                        className="core-searchable-input"
                        type="text"
                        value={projectQuery}
                        placeholder="Search project..."
                        autoFocus
                        onChange={(event) => {
                          setProjectQuery(event.target.value)
                        }}
                      />
                      <div className="core-searchable-list">
                        {filteredProjectOptions.length > 0 ? (
                          <>
                            {filteredProjectOptions.map((project) => (
                              <button
                                key={project.id}
                                type="button"
                                className="core-searchable-option"
                                onClick={() => handleProjectSelect(project)}
                              >
                                {project.name}
                              </button>
                            ))}
                            <button type="button" className="core-searchable-option" onClick={handleManualProjectSelect}>
                              Other (type manually)
                            </button>
                          </>
                        ) : (
                          <>
                            <div className="core-searchable-option" style={{ opacity: 0.7 }}>
                              No project found
                            </div>
                            <button type="button" className="core-searchable-option" onClick={handleManualProjectSelect}>
                              Other (type manually)
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
                {isManualProject ? (
                  <input
                    className="core-manual-input"
                    type="text"
                    value={manualProjectName}
                    placeholder="Type project name"
                    onChange={(event) => setManualProjectName(event.target.value)}
                  />
                ) : null}
              </div>

              <div className="core-form-field">
                <label className="core-form-label" htmlFor="core-area-search">
                  {isWrittenProject ? 'District' : 'Location'}
                </label>
                {isManualProject ? (
                  <input
                    className="core-manual-input"
                    type="text"
                    value={manualAreaName}
                    placeholder={`Type ${isWrittenProject ? 'district' : 'location'}`}
                    onChange={(event) => setManualAreaName(event.target.value)}
                  />
                ) : (
                  <div className="core-searchable-select">
                    <button
                      id="core-area-search"
                      type="button"
                      className="core-searchable-trigger"
                      onClick={() => setAreaOptionsOpen((prev) => !prev)}
                      disabled={!selectedProjectId || areaOptions.length === 0}
                      aria-expanded={areaOptionsOpen}
                    >
                      <span>{selectedAreaLabel}</span>
                      <span aria-hidden="true">{areaOptionsOpen ? '▴' : '▾'}</span>
                    </button>

                    {areaOptionsOpen ? (
                      <div className="core-searchable-panel" role="listbox">
                        <input
                          className="core-searchable-input"
                          type="text"
                          value={areaQuery}
                          placeholder={`Search ${isWrittenProject ? 'district' : 'location'}...`}
                          autoFocus
                          onChange={(event) => setAreaQuery(event.target.value)}
                        />
                        <div className="core-searchable-list">
                          {filteredAreaOptions.length > 0 ? (
                            filteredAreaOptions.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                className="core-searchable-option"
                                onClick={() => handleAreaSelect(option)}
                              >
                                {option.name}
                              </button>
                            ))
                          ) : (
                            <div className="core-searchable-option" style={{ opacity: 0.7 }}>
                              No {isWrittenProject ? 'district' : 'location'} found
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="core-form-actions">
                <button type="button" className="core-secondary-btn" onClick={returnToAttendanceType}>
                  Back
                </button>
                <button type="button" className="core-primary-btn" onClick={continueToCamera}>
                  Continue to camera
                </button>
              </div>
            </div>
          </section>
        </main>
      </>
    )
  }

  return (
    <>
      <style>{styles}</style>

      <div className="core-attendance-stage">
        <video ref={videoRef} autoPlay playsInline muted />
        {capturedImageDataUrl && (
          <img className="core-captured-frame" src={capturedImageDataUrl} alt="Captured face" />
        )}
        <div className="core-scan-overlay" aria-label="Face positioning guide">
          <div className="core-scan-frame">
            <span className="core-scan-corner top-right" />
            <span className="core-scan-corner bottom-left" />
          </div>
        </div>
        {capturedImageDataUrl && captureBusy && (
          <div className="core-scan-overlay" aria-label="Scanning face">
            <div className="core-scan-line" />
            <div className="core-scan-status">Scanning face</div>
          </div>
        )}

        <div className="core-attendance-overlay">
          <div className="core-top-bar">
            <div className="core-brand-pill">
              <span className="core-brand-mark">C</span>
              <span>Attendance</span>
            </div>
          </div>

          <div className="core-status-box">
            <p className="core-eyebrow">Live verification</p>
            <h1>{statusText}</h1>
          </div>
        </div>

        <div className="core-capture-bar">
          <button type="button" className="core-capture-btn" onClick={handleCapture} disabled={captureBusy}>
            {captureBusy ? 'Verifying...' : 'Capture'}
          </button>
        </div>
      </div>

      <div className={`core-success-screen ${successOpen ? 'open' : ''}`} aria-hidden={!successOpen}>
        <div className="core-success-shell">
          <div className="core-brand-row">
            <div className="core-brand-pill">
              <span className="core-brand-mark">C</span>
              <span>Attendance</span>
            </div>
            <span className="core-status-badge">Verified</span>
          </div>

          <div className="core-identity-card">
            <div className="core-photo-wrap">
              <div className="core-photo-circle">
                {capturedImageDataUrl ? (
                  <img src={capturedImageDataUrl} alt="Captured employee face" />
                ) : null}
              </div>
            </div>

            <div className="core-card-header">
              <div className="core-profile-avatar">{getInitials(verifiedEmployee?.name || 'Aisha Rahman')}</div>
              <div className="core-title-block">
                <h1>{verifiedEmployee?.name || 'Aisha Rahman'}</h1>
                <p>Face verified</p>
              </div>
            </div>

            <div className="core-card-grid">
              <div className="core-field">
                <span className="core-field-label">Role</span>
                <span className="core-field-value">{verifiedEmployee?.role || 'Travel Team'}</span>
              </div>

              <div className="core-field">
                <span className="core-field-label">Type</span>
                <span className="core-field-value">{attendanceType === 'travel' ? 'Travel' : 'Project'}</span>
              </div>

              <div className="core-field">
                <span className="core-field-label">Employee ID</span>
                <span className="core-field-value">{verifiedEmployee?.id || 'EMP-1024'}</span>
              </div>

              <div className="core-field">
                <span className="core-field-label">Time</span>
                <span className="core-field-value">{formattedTime}</span>
              </div>
            </div>

            <p className="core-summary-note">{responseMessage || 'Attendance has been recorded successfully.'}</p>

            <div className={`core-message-banner ${messageState.variant}`}>
              <span className="core-message-pill">{messageState.label}</span>
              <p>{responseMessage || 'Attendance has been recorded successfully.'}</p>
            </div>
          </div>

          <div className="core-action-row">
            <button type="button" className="core-primary-btn" onClick={resetToCamera}>
              Mark again
            </button>
          </div>
        </div>
      </div>

      {retakeOpen && (
        <div className="core-retake-screen" role="alertdialog" aria-modal="true" aria-labelledby="core-retake-title">
          <div className="core-retake-dialog">
            <div className="core-retake-badge" aria-hidden="true">!</div>
            <h2 id="core-retake-title">Face not verified</h2>
            <p>{statusText} Please make sure your face is clearly visible and try again.</p>
            <button type="button" className="core-retake-btn" onClick={retakeCapture}>
              Retake photo
            </button>
          </div>
        </div>
      )}
    </>
  )
}
