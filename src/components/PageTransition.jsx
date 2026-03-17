function PageTransition({ pageKey, children }) {
  return (
    <div
      key={pageKey}
      className='page-transition-shell'
      style={{ position: "absolute", inset: 0, width: "100%" }}
    >
      {children}
    </div>
  );
}

export default PageTransition;
