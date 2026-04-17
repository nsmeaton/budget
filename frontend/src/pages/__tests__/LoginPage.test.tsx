import { describe, it, expect } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '../LoginPage'
import { renderWithProviders } from '@/test/test-utils'

describe('LoginPage', () => {
  it('renders the sign-in form when setup is complete', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' })

    // Wait for loading to finish and form to appear
    await waitFor(() => {
      expect(screen.getByText('Sign In')).toBeInTheDocument()
    })

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders the description text for login', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' })

    await waitFor(() => {
      expect(screen.getByText('Enter your credentials to continue')).toBeInTheDocument()
    })
  })

  it('shows the budget emoji', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' })

    await waitFor(() => {
      expect(screen.getByText('💰')).toBeInTheDocument()
    })
  })

  it('allows typing into username and password fields', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginPage />, { route: '/login' })

    await waitFor(() => {
      expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    })

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordInput = screen.getByLabelText(/password/i)

    await user.type(usernameInput, 'admin')
    await user.type(passwordInput, 'password')

    expect(usernameInput).toHaveValue('admin')
    expect(passwordInput).toHaveValue('password')
  })

  it('submit button is not disabled initially', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled()
    })
  })
})
