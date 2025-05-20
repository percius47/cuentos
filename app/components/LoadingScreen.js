import React, { useState, useEffect } from "react";

export default function LoadingScreen({
  totalSteps = 3,
  currentStep = 0,
  status = "",
}) {
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  useEffect(() => {
    // Calculate progress percentage
    const progressPercentage = (currentStep / totalSteps) * 100;
    setProgress(progressPercentage);

    // Estimate time remaining (assuming each step takes about 30 seconds)
    const estimatedTimePerStep = 30;
    const remainingSteps = totalSteps - currentStep;
    setTimeRemaining(remainingSteps * estimatedTimePerStep);
  }, [currentStep, totalSteps]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  return (
    <div style={loadingOverlayStyle}>
      <div style={loadingContentStyle}>
        <h2 style={titleStyle}>Creating Your Story</h2>

        {/* Progress Bar */}
        <div style={progressBarContainerStyle}>
          <div
            style={{
              ...progressBarStyle,
              width: `${progress}%`,
            }}
          />
        </div>

        {/* Status Text */}
        <p style={statusStyle}>{status}</p>

        {/* Time Remaining */}
        <p style={timeStyle}>
          Estimated time remaining: {formatTime(timeRemaining)}
        </p>

        {/* Loading Animation */}
        <div style={loadingAnimationStyle}>
          <div style={{ ...loadingDotStyle, animationDelay: "-0.32s" }} />
          <div style={{ ...loadingDotStyle, animationDelay: "-0.16s" }} />
          <div style={loadingDotStyle} />
        </div>
      </div>
    </div>
  );
}

const loadingOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(62, 37, 61, 0.95)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  backdropFilter: "blur(5px)",
};

const loadingContentStyle = {
  backgroundColor: "#4e2d4d",
  padding: "2rem",
  borderRadius: "1rem",
  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  width: "90%",
  maxWidth: "500px",
  textAlign: "center",
  border: "2px solid #f6aa1d",
};

const titleStyle = {
  color: "#ffe2b9",
  fontSize: "1.5rem",
  marginBottom: "1.5rem",
  fontFamily: "LexendDeca, sans-serif",
};

const progressBarContainerStyle = {
  width: "100%",
  height: "20px",
  backgroundColor: "#3e253d",
  borderRadius: "10px",
  overflow: "hidden",
  marginBottom: "1rem",
};

const progressBarStyle = {
  height: "100%",
  backgroundColor: "#f6aa1d",
  transition: "width 0.3s ease-in-out",
  borderRadius: "10px",
};

const statusStyle = {
  color: "#ffe2b9",
  fontSize: "1.1rem",
  marginBottom: "0.5rem",
  fontFamily: "LexendDeca, sans-serif",
};

const timeStyle = {
  color: "#c68e77",
  fontSize: "0.9rem",
  marginBottom: "1.5rem",
  fontFamily: "LexendDeca, sans-serif",
};

const loadingAnimationStyle = {
  display: "flex",
  justifyContent: "center",
  gap: "0.5rem",
};

const loadingDotStyle = {
  width: "12px",
  height: "12px",
  backgroundColor: "#f6aa1d",
  borderRadius: "50%",
  animation: "bounce 1.4s infinite ease-in-out",
};

// Add the keyframes animation using a style tag in the head
if (typeof window !== "undefined") {
  const styleSheet = document.createElement("style");
  styleSheet.textContent = `
    @keyframes bounce {
      0%, 80%, 100% { 
        transform: scale(0);
      } 
      40% { 
        transform: scale(1.0);
      }
    }
  `;
  document.head.appendChild(styleSheet);
}
