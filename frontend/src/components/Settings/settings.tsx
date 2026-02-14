import './settings.css'
export default function Settings() {
  return (
    <div className="settings-blank">
      <h1 className="welcome-message">settings</h1>
      <div className="settings-actions">
        <button className="settings-action-button">
          <span className="settings-action-button__line settings-action-button__line--primary">profile settings</span>
          <span className="settings-action-button__line settings-action-button__line--secondary">view and edit account details</span>
        </button>
      </div>
    </div>
  )
}
