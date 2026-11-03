// Wraps every page so it eases in when you navigate (fade and rise). The header and dock stay still.
export default function Template({ children }) {
  return <div className="page-in">{children}</div>;
}
