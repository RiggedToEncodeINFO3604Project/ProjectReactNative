// Mocks

// Mock AsyncStorage so the axios request interceptor doesn't fail
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue('mock-token'),
  setItem: jest.fn().mockResolvedValue(null),
  multiGet: jest.fn().mockResolvedValue([['token', 'mock-token'], ['role', 'Provider'], ['userId', 'u1']]),
  multiRemove: jest.fn().mockResolvedValue(null),
}));

// Mock expo-constants to avoid native module crash
jest.mock('expo-constants', () => ({
  default: { expoConfig: { hostUri: 'localhost:8081' } },
}));

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

// Mock axios entirely so we control resolved/rejected values
jest.mock('axios', () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  const mockAxios = {
    create: jest.fn(() => mockAxiosInstance),
    post: jest.fn(),
    // expose the instance for direct assertion in tests
    __mockInstance: mockAxiosInstance,
  };
  return mockAxios;
});

// Importing after the mocks are registerd
import axios from 'axios';

// Grab instance after axios
const mockApi = (axios as any).__mockInstance as {
  get: jest.Mock;
  post: jest.Mock;
  put: jest.Mock;
  delete: jest.Mock;
};

// Functions to test
import {
  createCustomerNote,
  createCustomerTag,
  deleteCustomerNote,
  deleteCustomerTag,
  getCustomerSnapshot,
  updateCustomerNote,
  updateCustomerTag,
} from '@/services/schedulingApi';

// Fixtures

const CUSTOMER_ID = 'cust-001';
const TAG_ID = 'tag-abc';
const NOTE_ID = 'note-xyz';

const mockSnapshot = {
  customer_id: CUSTOMER_ID,
  customer_name: 'Alice Smith',
  customer_email: 'alice@example.com',
  customer_phone: '+1-555-0100',
  total_visits: 5,
  last_service_date: '2025-12-01',
  last_service_name: 'Haircut',
  payment_preference: 'Card',
  total_spent: 250.0,
  tags: [{ id: TAG_ID, tag: 'VIP', color: '#FFCC00', weight: 1 }],
  notes: [{ id: NOTE_ID, note: 'Prefers afternoon slots', created_at: '2025-11-01T10:00:00Z', updated_at: '2025-11-01T10:00:00Z' }],
};

const mockTag = { id: TAG_ID, tag: 'VIP', color: '#FFCC00' };
const mockNote = { id: NOTE_ID, note: 'Prefers afternoon slots', created_at: '2025-11-01T10:00:00Z', updated_at: '2025-11-01T10:00:00Z' };

// Helpers

// Mock resolve
const resolveWith = (mock: jest.Mock, payload: unknown) =>
  mock.mockResolvedValueOnce({ data: payload });

// Mock reject
const rejectWith = (mock: jest.Mock, detail = 'Server error', status = 500) =>
  mock.mockRejectedValueOnce({
    message: 'Request failed',
    response: { data: { detail }, status },
  });

// Tests

beforeEach(() => jest.clearAllMocks());

describe('getCustomerSnapshot', () => {
  it('returns a CustomerSnapshot on success', async () => {
    resolveWith(mockApi.get, mockSnapshot);

    const result = await getCustomerSnapshot(CUSTOMER_ID);

    expect(mockApi.get).toHaveBeenCalledWith(`/provider/customer/${CUSTOMER_ID}/snapshot`);
    expect(result).toEqual(mockSnapshot);
  });

  it('returns all expected top-level fields', async () => {
    resolveWith(mockApi.get, mockSnapshot);
    const result = await getCustomerSnapshot(CUSTOMER_ID);

    expect(result.customer_id).toBe(CUSTOMER_ID);
    expect(result.customer_name).toBe('Alice Smith');
    expect(result.total_visits).toBe(5);
    expect(result.total_spent).toBe(250.0);
    expect(Array.isArray(result.tags)).toBe(true);
    expect(Array.isArray(result.notes)).toBe(true);
  });

  it('throws and re-throws when the API returns an error', async () => {
    rejectWith(mockApi.get, 'Customer not found', 404);

    await expect(getCustomerSnapshot(CUSTOMER_ID)).rejects.toMatchObject({
      response: { status: 404 },
    });
  });

  it('uses the customerId in the URL path, not query params', async () => {
    resolveWith(mockApi.get, mockSnapshot);
    await getCustomerSnapshot('specific-id-99');

    const [calledUrl] = mockApi.get.mock.calls[0];
    expect(calledUrl).toContain('specific-id-99');
    expect(calledUrl).not.toContain('?');
  });
});

describe('createCustomerTag', () => {
  it('sends POST to the correct URL with tag payload', async () => {
    resolveWith(mockApi.post, mockTag);
    const result = await createCustomerTag(CUSTOMER_ID, { tag: 'VIP', color: '#FFCC00' });

    expect(mockApi.post).toHaveBeenCalledWith(
      `/provider/customer/${CUSTOMER_ID}/tags`,
      { tag: 'VIP', color: '#FFCC00' }
    );
    expect(result).toEqual(mockTag);
  });

  it('returns the created tag object containing id, tag, color', async () => {
    resolveWith(mockApi.post, mockTag);
    const result = await createCustomerTag(CUSTOMER_ID, { tag: 'VIP', color: '#FFCC00' });

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('tag');
    expect(result).toHaveProperty('color');
  });

  it('propagates API error on failure', async () => {
    rejectWith(mockApi.post, 'Tag already exists', 409);

    await expect(
      createCustomerTag(CUSTOMER_ID, { tag: 'VIP', color: '#FFCC00' })
    ).rejects.toMatchObject({ response: { status: 409 } });
  });
});

describe('updateCustomerTag', () => {
  it('sends PUT to /provider/tags/{tagId} with updated data', async () => {
    resolveWith(mockApi.put, { ...mockTag, tag: 'Premium' });
    await updateCustomerTag(TAG_ID, { tag: 'Premium', color: '#AF52DE' });

    expect(mockApi.put).toHaveBeenCalledWith(
      `/provider/tags/${TAG_ID}`,
      { tag: 'Premium', color: '#AF52DE' }
    );
  });

  it('accepts a partial payload (only color)', async () => {
    resolveWith(mockApi.put, mockTag);
    await updateCustomerTag(TAG_ID, { color: '#34C759' });

    const [, body] = mockApi.put.mock.calls[0];
    expect(body).toEqual({ color: '#34C759' });
    expect(body).not.toHaveProperty('tag');
  });

  it('propagates API error on failure', async () => {
    rejectWith(mockApi.put, 'Tag not found', 404);
    await expect(updateCustomerTag(TAG_ID, { tag: 'x' })).rejects.toMatchObject({
      response: { status: 404 },
    });
  });
});

describe('deleteCustomerTag', () => {
  it('sends DELETE to /provider/tags/{tagId}', async () => {
    resolveWith(mockApi.delete, { message: 'Deleted' });
    await deleteCustomerTag(TAG_ID);

    expect(mockApi.delete).toHaveBeenCalledWith(`/provider/tags/${TAG_ID}`);
  });

  it('propagates API error on failure', async () => {
    rejectWith(mockApi.delete, 'Forbidden', 403);
    await expect(deleteCustomerTag(TAG_ID)).rejects.toMatchObject({
      response: { status: 403 },
    });
  });
});

describe('createCustomerNote', () => {
  it('sends POST to the correct URL with note payload', async () => {
    resolveWith(mockApi.post, mockNote);
    const result = await createCustomerNote(CUSTOMER_ID, { note: 'Prefers afternoon slots' });

    expect(mockApi.post).toHaveBeenCalledWith(
      `/provider/customer/${CUSTOMER_ID}/notes`,
      { note: 'Prefers afternoon slots' }
    );
    expect(result).toEqual(mockNote);
  });

  it('returned note has id, note, created_at, updated_at', async () => {
    resolveWith(mockApi.post, mockNote);
    const result = await createCustomerNote(CUSTOMER_ID, { note: 'Test' });

    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('note');
    expect(result).toHaveProperty('created_at');
    expect(result).toHaveProperty('updated_at');
  });

  it('propagates API error on failure', async () => {
    rejectWith(mockApi.post, 'Internal server error', 500);
    await expect(
      createCustomerNote(CUSTOMER_ID, { note: 'Test' })
    ).rejects.toMatchObject({ response: { status: 500 } });
  });
});

describe('updateCustomerNote', () => {
  it('sends PUT to /provider/notes/{noteId}', async () => {
    resolveWith(mockApi.put, { ...mockNote, note: 'Updated content' });
    await updateCustomerNote(NOTE_ID, { note: 'Updated content' });

    expect(mockApi.put).toHaveBeenCalledWith(
      `/provider/notes/${NOTE_ID}`,
      { note: 'Updated content' }
    );
  });

  it('propagates API error on failure', async () => {
    rejectWith(mockApi.put, 'Note not found', 404);
    await expect(updateCustomerNote(NOTE_ID, { note: 'x' })).rejects.toMatchObject({
      response: { status: 404 },
    });
  });
});

describe('deleteCustomerNote', () => {
  it('sends DELETE to /provider/notes/{noteId}', async () => {
    resolveWith(mockApi.delete, { message: 'Deleted' });
    await deleteCustomerNote(NOTE_ID);

    expect(mockApi.delete).toHaveBeenCalledWith(`/provider/notes/${NOTE_ID}`);
  });

  it('propagates API error on failure', async () => {
    rejectWith(mockApi.delete, 'Forbidden', 403);
    await expect(deleteCustomerNote(NOTE_ID)).rejects.toMatchObject({
      response: { status: 403 },
    });
  });
});
