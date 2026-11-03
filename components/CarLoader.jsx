// Small car driving along a dashed road. Use it wherever something is loading.
export default function CarLoader({ label = '' }) {
  return (
    <div className="carload" role="status" aria-live="polite">
      <div className="track">
        <img className="cl-car" src="/ike-car.svg" alt="" draggable="false" />
        <span className="cl-road" />
      </div>
      {label && <div className="m">{label}</div>}
    </div>
  );
}
