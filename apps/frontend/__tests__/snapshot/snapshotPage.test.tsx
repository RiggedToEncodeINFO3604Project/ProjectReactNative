// Mocks

const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: () => ({ back: mockRouterBack }),
}));

jest.mock('@/services/schedulingApi', () => ({
  getCustomerSnapshot: jest.fn(),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    isDarkMode: false,
    colours: {},
  }),
}));

// Trying to only focus on container
jest.mock('@/components/CustomerSnapshotView', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: () => React.createElement(Text, null, 'SNAPSHOT_VIEW_RENDERED'),
  };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('mock-token'),
  multiRemove: jest.fn().mockResolvedValue(null),
}));

// Imports

import CustomerSnapshotScreen from '@/app/(provider)/snapshot/[customerId]';
import { getCustomerSnapshot } from '@/services/schedulingApi';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

const mockGetCustomerSnapshot = getCustomerSnapshot as jest.Mock;
const mockUseLocalSearchParams = useLocalSearchParams as jest.Mock;

// Fixtures

const mockSnapshot = {
  customer_id: 'cust-001',
  customer_name: 'Alice Smith',
  customer_email: 'alice@example.com',
  customer_phone: '+1-555-0100',
  total_visits: 5,
  last_service_date: '2025-12-01',
  last_service_name: 'Haircut',
  payment_preference: 'Card',
  total_spent: 250.0,
  tags: [],
  notes: [],
};

// Helpers

function setupParams(overrides: { customerId?: string | string[]; cachedSnapshot?: string }) {
  mockUseLocalSearchParams.mockReturnValue({
    customerId: 'cust-001',
    ...overrides,
  });
}

function renderScreen() {
  return render(<CustomerSnapshotScreen />);
}

// Tests

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Loading via cached snapshot param', () => {
  it('shows the snapshot view immediately without calling the API', async () => {
    setupParams({ cachedSnapshot: JSON.stringify(mockSnapshot) });

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('SNAPSHOT_VIEW_RENDERED')).toBeTruthy();
    });
    expect(mockGetCustomerSnapshot).not.toHaveBeenCalled();
  });

  it('falls through to the API when cachedSnapshot JSON is malformed', async () => {
    setupParams({ cachedSnapshot: '{THIS IS NOT VALID JSON' });
    mockGetCustomerSnapshot.mockResolvedValueOnce(mockSnapshot);

    renderScreen();

    await waitFor(() => {
      expect(mockGetCustomerSnapshot).toHaveBeenCalledWith('cust-001');
    });
  });
});

describe('Loading via API call', () => {
  it('calls getCustomerSnapshot with the correct customerId', async () => {
    setupParams({});
    mockGetCustomerSnapshot.mockResolvedValueOnce(mockSnapshot);

    renderScreen();

    await waitFor(() => {
      expect(mockGetCustomerSnapshot).toHaveBeenCalledWith('cust-001');
    });
  });

  it('renders the snapshot view after a successful API response', async () => {
    setupParams({});
    mockGetCustomerSnapshot.mockResolvedValueOnce(mockSnapshot);

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText('SNAPSHOT_VIEW_RENDERED')).toBeTruthy();
    });
  });

  it('handles customerId supplied as an array — uses first element', async () => {
    setupParams({ customerId: ['cust-array-01', 'ignored'] });
    mockGetCustomerSnapshot.mockResolvedValueOnce(mockSnapshot);

    renderScreen();

    await waitFor(() => {
      expect(mockGetCustomerSnapshot).toHaveBeenCalledWith('cust-array-01');
    });
  });
});

describe('Missing customerId', () => {
  it('shows an error message when customerId is absent', async () => {
    mockUseLocalSearchParams.mockReturnValue({ customerId: undefined });

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText(/customer id is missing/i)).toBeTruthy();
    });
  });

  it('does not call the API when customerId is absent', async () => {
    mockUseLocalSearchParams.mockReturnValue({ customerId: undefined });

    renderScreen();

    await waitFor(() => {
      // Loading finishes, no API call made
      expect(mockGetCustomerSnapshot).not.toHaveBeenCalled();
    });
  });
});

describe('API error handling', () => {
  it('shows error text when the API rejects with a message', async () => {
    setupParams({});
    mockGetCustomerSnapshot.mockRejectedValueOnce({
      message: 'Network error',
      response: undefined,
    });

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText(/network error/i)).toBeTruthy();
    });
  });

  it('shows server detail when the API returns a detail field', async () => {
    setupParams({});
    mockGetCustomerSnapshot.mockRejectedValueOnce({
      message: 'Request failed',
      response: { data: { detail: 'Customer not found' } },
    });

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText(/customer not found/i)).toBeTruthy();
    });
  });

  it('falls back to "Failed to load snapshot" when no message or detail', async () => {
    setupParams({});
    mockGetCustomerSnapshot.mockRejectedValueOnce({});

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText(/failed to load snapshot/i)).toBeTruthy();
    });
  });

  it('shows a Retry button on error', async () => {
    setupParams({});
    mockGetCustomerSnapshot.mockRejectedValueOnce({ message: 'timeout' });

    const { getByText } = renderScreen();

    await waitFor(() => {
      expect(getByText(/retry/i)).toBeTruthy();
    });
  });

  it('re-calls the API when the Retry button is pressed', async () => {
    setupParams({});
    mockGetCustomerSnapshot
      .mockRejectedValueOnce({ message: 'timeout' })
      .mockResolvedValueOnce(mockSnapshot);

    const { getByText } = renderScreen();

    await waitFor(() => expect(getByText(/retry/i)).toBeTruthy());
    fireEvent.press(getByText(/retry/i));

    await waitFor(() => {
      expect(mockGetCustomerSnapshot).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Header & layout', () => {
  it('always renders the "Customer Snapshot" title', async () => {
    setupParams({ cachedSnapshot: JSON.stringify(mockSnapshot) });
    const { getByText } = renderScreen();
    // Title is rendered immediately regardless of loading state
    expect(getByText('Customer Snapshot')).toBeTruthy();
  });
});
