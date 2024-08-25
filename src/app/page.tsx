import Link from 'next/link'
import { getCloneDetails } from './actions'

const styles = {
  main: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '1rem',
    backgroundColor: '#f3f4f6',
  },
  title: {
    fontSize: '2.25rem',
    fontWeight: 'bold',
    marginBottom: '2rem',
    color: '#1f2937',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    padding: '1.5rem',
    marginBottom: '2rem',
    maxWidth: '36rem',
    width: '100%',
  },
  subtitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '1rem',
    color: '#1f2937',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '0.5rem 1rem',
  },
  label: {
    fontWeight: '600',
  },
  profileImage: {
    width: '200px',
    height: '200px',
    borderRadius: '50%',
    marginRight: '1rem',
  },
  button: {
    backgroundColor: '#3b82f6',
    color: 'white',
    fontWeight: 'bold',
    padding: '0.5rem 1rem',
    borderRadius: '0.25rem',
    textDecoration: 'none',
    marginTop: '15px',
  },
}

export default async function Home() {
  const cloneData = await getCloneDetails()
  const { clone } = cloneData

  return (
    <main style={styles.main}>
      <h1 style={styles.title}>Delphi External API Demo Application</h1>
      <div style={styles.card}>
      {clone.imageUrl && (
          <div>
            <img src={clone.imageUrl} alt={clone.name} style={styles.profileImage} />
          </div>
        )}
        <h2 style={styles.subtitle}>Clone Details</h2>
        <div style={styles.grid}>
          <p style={styles.label}>Name:</p>
          <p>{clone.name}</p>
          <p style={styles.label}>Description:</p>
          <p>{clone.description}</p>
          <p style={styles.label}>Purpose:</p>
          <p>{clone.purpose}</p>
          <p style={styles.label}>Slug:</p>
          <p>{clone.slug}</p>
          <p style={styles.label}>Tags:</p>
          <p>{clone.tags.join(', ')}</p>
        </div>
      </div>
      <Link href="/call" style={styles.button}>
        Call
      </Link>
      <Link href="/text" style={styles.button}>
        Text
      </Link>
    </main>
  )
}