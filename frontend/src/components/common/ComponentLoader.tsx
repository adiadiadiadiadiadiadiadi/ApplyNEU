import './loaders.css'

type Props = {
  label?: string
}

const ComponentLoader = ({ label = 'loading' }: Props) => {
  return (
    <div className="component-loader">
      <div className="component-loader__spinner" role="status" aria-label={label}>
        <div className="component-loader__ring" />
        <div className="component-loader__ring component-loader__ring--accent" />
        <div className="component-loader__core" />
      </div>
      <span className="component-loader__label">{label}</span>
    </div>
  )
}

export default ComponentLoader
