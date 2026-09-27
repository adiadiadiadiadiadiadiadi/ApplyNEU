import './loaders.css'

type Props = {
  label?: string
  fullPage?: boolean
}

const ComponentLoader = ({ label = 'loading', fullPage = false }: Props) => {
  return (
    <div className={`component-loader${fullPage ? ' component-loader--page' : ''}`}>
      <div className="component-loader__spinner" role="status" aria-label={label}>
        <div className="component-loader__ring" />
        <div className="component-loader__ring component-loader__ring--accent" />
        <div className="component-loader__core" />
      </div>
    </div>
  )
}

export default ComponentLoader
