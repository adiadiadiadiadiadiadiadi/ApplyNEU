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
  const [interests, setInterests] = useState<string[]>([])
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const jobTypes = ['Co-op', 'Full Time / Part Time', 'Internship']
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([])

  const fetchInterests = async (userId: string) => {
    try {
      const response = await fetch(`http://localhost:8080/resumes/${userId}/possible-interests`)
      if (response.ok) {
        const data = await response.json()
        setInterests(data)
      }
    } catch (error) {
      console.error('Error fetching interests:', error)
    }
  }

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    )
  }

  const toggleJobType = (type: string) => {
    setSelectedJobTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    )
  }

  const saveInterests = async (userId: string) => {
    try {
      const response = await fetch(`http://localhost:8080/users/${userId}/interests`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interests: selectedInterests
        })
      })
      
      if (response.ok) {
        
        // Update search terms after saving interests
        await updateSearchTerms(userId)
      }
    } catch (error) {
      console.error('Error saving interests:', error)
    }
  }

  const updateJobTypes = async (userId: string) => {
    try {
      const response = await fetch(`http://localhost:8080/users/${userId}/job-types`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          job_types: selectedJobTypes
        })
      })
    } catch (error) {
      console.error('Error updating job types:', error)
    }
  }

  const updateSearchTerms = async (userId: string) => {
    try {
      const response = await fetch(`http://localhost:8080/users/${userId}/search-terms`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (response.ok) {
        console.log('Search terms updated successfully')
      }
    } catch (error) {
      console.error('Error updating search terms:', error)
    }
  }

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
    if (step === 1) {
      setStep(2)
      return
    }

    if (step === 2) {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      await updateJobTypes(user.id)
      setLoading(false)
      setStep(3)
      return
    }

    if (step === 3 && uploadedFile) {
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
            
            if (saveResponse.ok) {
              // Cache short resume
              await fetch(`http://localhost:8080/users/${user.id}/cache-short-resume`, { method: 'POST' })
              // Fetch interests before advancing to step 4
              await fetchInterests(user.id)
            }
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
      setStep(4)
      return
    }

    if (step === 3) {
      // Require upload; button disabled when no file.
      return
    }

    // step 4 -> complete
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await saveInterests(user.id)
    }
    handleComplete()
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
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
          <span className="progress-text">step {step} of 4</span>
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
            <h1 className="onboarding-title">what type of job are you looking for?</h1>
            <p className="onboarding-description">
              choose one or more options that match the roles you want.
            </p>
            <div className="interests-grid">
              {jobTypes.map((type, index) => (
                <span
                  key={index}
                  className={`interest-tag ${selectedJobTypes.includes(type) ? 'interest-tag--selected' : ''}`}
                  onClick={() => toggleJobType(type)}
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
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

        {step === 4 && (
          <div className="onboarding-step">
            <h1 className="onboarding-title">select your interests</h1>
            <p className="onboarding-description">
              we'll use these to filter jobs for you.
            </p>
            <div className="interests-grid">
              {interests.map((interest, index) => (
                <span 
                  key={index} 
                  className={`interest-tag ${selectedInterests.includes(interest) ? 'interest-tag--selected' : ''}`}
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </span>
              ))}
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
            disabled={
              loading ||
              (step === 2 && selectedJobTypes.length === 0) ||
              (step === 3 && !uploadedFile) ||
              (step === 4 && selectedInterests.length === 0)
            }
          >
            {loading ? 'loading...' : step === 4 ? 'finish' : 'next'}
          </button>
        </div>
      </div>
    </div>
  )
}