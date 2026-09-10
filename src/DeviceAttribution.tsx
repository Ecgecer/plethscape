import sensorBioLogo from './assets/sensorbio-wordmark.svg';

export default function DeviceAttribution({ mobile = false }: { mobile?: boolean }) {
  return <div className={`device-attribution${mobile ? ' device-attribution-mobile' : ''}`}>
    <span>Device design inspired by</span>
    <a href="https://sensorbio.com/" target="_blank" rel="noopener noreferrer" aria-label="Visit Sensor Bio (opens in a new tab)">
      <img src={sensorBioLogo} alt="Sensor Bio" width="98" height="18" />
    </a>
  </div>;
}
