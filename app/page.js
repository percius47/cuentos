import BookGenerationForm from "./components/BookGenerationForm";

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#ffe2b9",
        color: "#3e253d",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <nav
        style={{
          backgroundColor: "#3682a2",
          padding: "1rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
          }}
        >
          <h1
            style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#ffe2b9" }}
          >
            Cuentos
          </h1>
        </div>
      </nav>

      <main
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "2.5rem 1rem",
          flexGrow: 1,
        }}
      >
        <header style={{ marginBottom: "2.5rem", textAlign: "center" }}>
          <h1
            style={{
              fontSize: "2.5rem",
              fontWeight: "bold",
              color: "#3e253d",
              marginBottom: "0.75rem",
            }}
          >
            Personalized Stories
          </h1>
          <p style={{ fontSize: "1.125rem", color: "#c68e77" }}>
            Create unique stories for the children in your life
          </p>
        </header>

        <div style={{ maxWidth: "42rem", margin: "0 auto" }}>
          <BookGenerationForm />
        </div>
      </main>

      <footer
        style={{
          marginTop: "auto",
          padding: "1.5rem 0",
          textAlign: "center",
          color: "#ffe2b9",
          fontSize: "0.875rem",
          backgroundColor: "#3e253d",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <p>© 2025 Cuentos. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
