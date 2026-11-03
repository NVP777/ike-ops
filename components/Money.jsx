export default function Money({ v }) {
  const neg = v < 0;
  return (
    <span>
      {neg && '−'}<span className="rs">₹</span>{Math.abs(v).toLocaleString('en-IN')}
    </span>
  );
}