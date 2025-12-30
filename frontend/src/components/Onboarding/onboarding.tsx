import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import './onboarding.css'

interface OnboardingProps {
  onComplete: () => void
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleComplete = async () => {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      await supabase.auth.updateUser({
        data: {
          ...user.user_metadata,
          onboarding_completed: true
        }
      })
    }

    setLoading(false)
    onComplete()
  }

  const nextStep = async () => {
    if (step === 2 && uploadedFile) {
      setLoading(true)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch('http://localhost:8080/resumes/upload-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_name: uploadedFile.name,
            file_type: uploadedFile.type,
            file_size: uploadedFile.size
          })
        })

        if (response.ok) {
          const { uploadUrl, key, resumeId } = await response.json()

          const uploadResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': uploadedFile.type,
            },
            body: uploadedFile
          })

          if (uploadResponse.ok) {
            const saveResponse = await fetch('http://localhost:8080/resumes/save-resume', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                resume_id: resumeId,
                key: key,
                user_id: user.id,
                file_name: uploadedFile.name,
                file_size_bytes: uploadedFile.size
              })
            })
          } else {
            setLoading(false)
            return
          }
        } else {
          setLoading(false)
          return
        }
      } catch (error) {
        setLoading(false)
        return
      }

      setLoading(false)
      setStep(3)
    } else if (step < 3) {
      setStep(step + 1)
    } else {
      handleComplete()
    }
  }

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleFileSelect = (file: File) => {
    if (file.type === 'application/pdf') {
      setUploadedFile(file)
      console.log('PDF selected:', file.name)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
  }

  return (
    <div className="onboarding-container">
      <div className="onboarding-content">
        <div className="onboarding-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
          <span className="progress-text">step {step} of 3</span>
        </div>

        {step === 1 && (
          <div className="onboarding-step">
            <h1 className="onboarding-title">welcome</h1>
            <p className="onboarding-description">
              welcome to your personal co-op application tracker and assistant.
            </p>
            <div className="onboarding-features">
              <div className="feature-item">
                <span className="feature-icon">✓</span>
                <span className="feature-text">track all your applications in one place</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">✓</span>
                <span className="feature-text">automated application assistance</span>
              </div>
              <div className="feature-item">
                <span className="feature-icon">✓</span>
                <span className="feature-text">deadline reminders and task management</span>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step">
            <h1 className="onboarding-title">upload your resume</h1>
            <p className="onboarding-description">
              AI agents parse your resume to find jobs that best match your strengths.
            </p>
            <div
              className={`upload-zone ${isDragging ? 'dragging' : ''} ${uploadedFile ? 'has-file' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => !uploadedFile && document.getElementById('file-input')?.click()}
            >
              {!uploadedFile ? (
                <>
                  <div className="upload-icon">📄</div>
                  <p className="upload-text">
                    drag and drop your resume here
                  </p>
                  <p className="upload-subtext">or click to browse</p>
                  <p className="upload-format">PDF files only</p>
                  <input
                    id="file-input"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileInput}
                    style={{ display: 'none' }}
                  />
                </>
              ) : (
                <div className="uploaded-file">
                  <div className="file-info">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{uploadedFile.name}</span>
                  </div>
                  <button
                    className="remove-file"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile()
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-step">
            <h1 className="onboarding-title">you're all set!</h1>
            <p className="onboarding-description">
              ready to start your co-op application journey?
              let's dive into your personalized dashboard.
            </p>
            <div className="onboarding-final">
              <div className="final-tip">
                <span className="tip-icon">💡</span>
                <span className="tip-text">
                  <strong>pro tip:</strong> start by adding your first application to get familiar with the platform
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="onboarding-actions">
          {step > 1 && (
            <button
              onClick={prevStep}
              className="onboarding-button onboarding-button--secondary"
            >
              back
            </button>
          )}
          <button
            onClick={nextStep}
            className="onboarding-button onboarding-button--primary"
            disabled={loading || (step === 2 && !uploadedFile)}
          >
            {loading ? 'completing...' : step === 3 ? 'get started' : 'next'}
          </button>
        </div>
      </div>
    </div>
  )
}

