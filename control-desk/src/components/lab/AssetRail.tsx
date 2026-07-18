import { ASSET_DEFINITIONS, getAssetDefinition } from '../../models/registry'
import { useLabStore } from '../../store/useLabStore'
import { EFFECTS } from './effectOptions'

export function AssetRail() {
  const assetId = useLabStore((state) => state.assetId)
  const effectPreset = useLabStore((state) => state.effectPreset)
  const mode = useLabStore((state) => state.mode)
  const setAssetId = useLabStore((state) => state.setAssetId)
  const triggerEffect = useLabStore((state) => state.triggerEffect)
  const activeAsset = getAssetDefinition(assetId)

  return (
    <aside className="asset-rail" aria-label="Asset registry">
      <div className="rail-heading">
        <span>Asset register</span>
        <strong>{String(ASSET_DEFINITIONS.length).padStart(2, '0')}</strong>
      </div>

      <div className="asset-list">
        {ASSET_DEFINITIONS.map((asset, index) => (
          <button
            className={asset.id === assetId ? 'asset-row is-active' : 'asset-row'}
            key={asset.id}
            onClick={() => setAssetId(asset.id)}
            type="button"
          >
            <span className="asset-index">A-{String(index + 1).padStart(2, '0')}</span>
            <span className="asset-copy">
              <strong>{asset.label}</strong>
              <small>{asset.category}</small>
            </span>
            <span className={`asset-status asset-status--${asset.status}`}>{asset.status}</span>
          </button>
        ))}
      </div>

      {mode === 'models' ? (
        <div className="rail-actions">
          <span>Model reactions / {activeAsset.label}</span>
          <div>
            {EFFECTS.map((effect) => (
              <button
                aria-label={`Replay ${effect.label} for ${activeAsset.label}`}
                aria-pressed={effectPreset === effect.id}
                className={effectPreset === effect.id ? 'is-active' : ''}
                key={effect.id}
                onClick={() => triggerEffect(effect.id)}
                type="button"
              >{effect.label}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rail-note">
          <span>System FX</span>
          <p>This route couples the selected prop with the finance screen and global impact response. Use Model Floor for construction review.</p>
        </div>
      )}
    </aside>
  )
}
