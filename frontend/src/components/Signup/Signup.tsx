import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import './signup.css'

interface SignupProps {
    onNavigateToLogin: () => void
}

export default function Signup({ onNavigateToLogin }: SignupProps) {
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [email, setEmail] = useState('')
    const [graduationYear, setGraduationYear] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [verificationCode, setVerificationCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [step, setStep] = useState<'signup' | 'verify'>('signup')

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (!email.endsWith('@northeastern.edu')) {
            setError('please use a valid @northeastern.edu email address')
            setLoading(false)
            return
        }

        if (password !== confirmPassword) {
            setError('passwords do not match')
            setLoading(false)
            return
        }

        if (password.length < 6) {
            setError('password must be at least 6 characters')
            setLoading(false)
            return
        }

        const year = parseInt(graduationYear)
        if (isNaN(year) || year < 2000 || year > 2040) {
            setError('please enter a valid graduation year')
            setLoading(false)
            return
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    graduation_year: graduationYear,
                }
            }
        })

        if (error) {
            setError(error.message)
        } else {
            const userId = data.user?.id
            
            if (userId) {
                try {
                    const response = await fetch('http://localhost:8080/users/new', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            user_id: userId,
                            first_name: firstName,
                            last_name: lastName,
                            email: email,
                            grad_year: parseInt(graduationYear)
                        })
                    })
                    
                    if (!response.ok) {
                        console.error('Failed to create user in database')
                    }
                } catch (err) {
                    console.error('Error creating user in database:', err)
                }
            }
            
            setStep('verify')
        }
        setLoading(false)
    }

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.verifyOtp({
            email,
            token: verificationCode,
            type: 'signup',
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            await fetch("http://localhost:3000/api/users", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({firstName, lastName, email, graduationYear}),
            });
        }
    }

    const handleResendCode = async () => {
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.resend({
            type: 'signup',
            email,
        })

        if (error) {
            setError(error.message)
        } else {
            setError('verification code resent!')
        }
        setLoading(false)
    }

    if (step === 'verify') {
        return (
            <div className="signup-container">
                <div className="signup-content">
                    <h1 className="signup-title">enter verification code</h1>
                    <p className="signup-success-text">
                        we've sent an 8-digit code to {email}
                    </p>

                    <form onSubmit={handleVerify} className="signup-form">
                        <input
                            type="text"
                            placeholder="enter 8-digit code"
                            value={verificationCode}
                            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                            className="signup-input signup-input--code"
                            maxLength={8}
                            required
                        />

                        {error && <div className="signup-error">{error}</div>}

                        <button
                            type="submit"
                            className="signup-button"
                            disabled={loading || verificationCode.length !== 8}
                        >
                            {loading ? 'verifying...' : 'verify'}
                        </button>
                    </form>

                    <div className="signup-footer">
                        didn't receive the code?{' '}
                        <a href="#" onClick={(e) => { e.preventDefault(); handleResendCode(); }} className="signup-link">
                            resend
                        </a>
                    </div>

                    <div className="signup-footer">
                        <a href="#" onClick={(e) => { e.preventDefault(); setStep('signup'); }} className="signup-link">
                            back to signup
                        </a>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="signup-container">
            <div className="signup-content">
                <h1 className="signup-title">create your account</h1>

                <form onSubmit={handleSignup} className="signup-form">
                    <div className="signup-row">
                        <input
                            type="text"
                            placeholder="first name"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="signup-input signup-input--half"
                            required
                        />
                        <input
                            type="text"
                            placeholder="last name"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="signup-input signup-input--half"
                            required
                        />
                    </div>

                    <input
                        type="email"
                        placeholder="email (@northeastern.edu)"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="signup-input"
                        required
                    />

                    <input
                        type="number"
                        placeholder="graduation year"
                        value={graduationYear}
                        onChange={(e) => setGraduationYear(e.target.value)}
                        className="signup-input signup-input--year"
                        min="2000"
                        max="2040"
                        required
                    />

                    <input
                        type="password"
                        placeholder="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="signup-input"
                        required
                    />

                    <input
                        type="password"
                        placeholder="confirm password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="signup-input"
                        required
                    />

                    {error && <div className="signup-error">{error}</div>}

                    <button
                        type="submit"
                        className="signup-button"
                        disabled={loading}
                    >
                        {loading ? 'creating account...' : 'sign up'}
                    </button>
                </form>

                <div className="signup-footer">
                    already have an account?{' '}
                    <a href="#" onClick={(e) => { e.preventDefault(); onNavigateToLogin(); }} className="signup-link">
                        login
                    </a>
                </div>
            </div>
        </div>
    )
}
