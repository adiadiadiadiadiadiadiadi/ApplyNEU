import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import './onboarding.css'

interface OnboardingProps {
  onComplete: () => void
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

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

  const nextStep = () => {
    if (step < 3) {
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
            <h1 className="onboarding-title">how it works</h1>
            <p className="onboarding-description">
              ApplyNEU streamlines your co-op application process with intelligent automation.
            </p>
            <div className="onboarding-process">
              <div className="process-step">
                <div className="process-number">1</div>
                <div className="process-content">
                  <h3>add applications</h3>
                  <p>keep track of all the companies you're applying to</p>
                </div>
              </div>
              <div className="process-step">
                <div className="process-number">2</div>
                <div className="process-content">
                  <h3>automate tasks</h3>
                  <p>let our AI assist you with repetitive tasks</p>
                </div>
              </div>
              <div className="process-step">
                <div className="process-number">3</div>
                <div className="process-content">
                  <h3>land your co-op</h3>
                  <p>stay organized and never miss a deadline</p>
                </div>
              </div>
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
            disabled={loading}
          >
            {loading ? 'completing...' : step === 3 ? 'get started' : 'next'}
          </button>
        </div>

        <button 
          onClick={handleComplete}
          className="onboarding-skip"
          disabled={loading}
        >
          skip for now
        </button>
      </div>
    </div>
  )
}

