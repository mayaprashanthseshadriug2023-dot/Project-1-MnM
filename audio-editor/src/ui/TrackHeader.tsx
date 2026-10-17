import type { Track } from '../model/types'

type Settings = Partial<Pick<Track, 'volume' | 'mute' | 'solo'>>

interface Props {
  track: Track
  selected: boolean
  onSelect: () => void
  onChange: (settings: Settings) => void
}

export function TrackHeader({ track, selected, onSelect, onChange }: Props) {
  return (
    <div className={`track-header${selected ? ' selected' : ''}`} onClick={onSelect}>
      <span className="track-name">{track.name}</span>
      {/* Letters as well as colour, so state never relies on colour alone (A3 4.7) */}
      <button className={track.mute ? 'on' : ''} title="Mute" aria-pressed={track.mute}
        onClick={e => { e.stopPropagation(); onChange({ mute: !track.mute }) }}>M</button>
      <button className={track.solo ? 'on solo' : ''} title="Solo" aria-pressed={track.solo}
        onClick={e => { e.stopPropagation(); onChange({ solo: !track.solo }) }}>S</button>
      <input type="range" min={0} max={1.5} step={0.01} value={track.volume}
        aria-label={`${track.name} volume`} title="Volume"
        onClick={e => e.stopPropagation()}
        onChange={e => onChange({ volume: Number(e.target.value) })} />
    </div>
  )
}