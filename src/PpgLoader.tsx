const trace = "M0 53H28C35 53 35 9 45 9S53 39 64 33S73 43 87 48S105 53 120 53H148C155 53 155 9 165 9S173 39 184 33S193 43 207 48S225 53 240 53";
export default function PpgLoader() {
  return <div className="ppg-loader-window" aria-hidden="true"><div className="ppg-loader-ribbon">
    {[0, 1].map(index => <svg key={index} viewBox="0 0 240 64"><path d={trace}/></svg>)}
  </div></div>;
}
