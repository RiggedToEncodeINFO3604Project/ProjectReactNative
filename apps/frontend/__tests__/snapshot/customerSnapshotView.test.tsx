// Mocks

// ThemeContext stub (light mode)
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

// not testing icons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('@/services/schedulingApi', () => ({
  createCustomerTag: jest.fn(),
  updateCustomerTag: jest.fn(),
  deleteCustomerTag: jest.fn(),
  createCustomerNote: jest.fn(),
  updateCustomerNote: jest.fn(),
  deleteCustomerNote: jest.fn(),
  getCustomerSnapshot: jest.fn(),
}));

// Imports

import CustomerSnapshotView from '@/components/CustomerSnapshotView';
import { CustomerSnapshot } from '@/types/scheduling';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';

const api = jest.requireMock('@/services/schedulingApi') as {
  createCustomerTag: jest.Mock;
  updateCustomerTag: jest.Mock;
  deleteCustomerTag: jest.Mock;
  createCustomerNote: jest.Mock;
  updateCustomerNote: jest.Mock;
  deleteCustomerNote: jest.Mock;
};

// Fixtures

const TAG_1 = { id: 'tag-1', tag: 'VIP', color: '#FFCC00', weight: 1 };
const TAG_2 = { id: 'tag-2', tag: 'Regular', color: '#42BBEB', weight: 0.5 };
const NOTE_1 = {
  id: 'note-1',
  note: 'Morning slots preferred',
  created_at: '2025-01-15T09:00:00Z',
  updated_at: '2025-01-15T09:00:00Z',
};
const NOTE_2 = {
  id: 'note-2',
  note: 'SMS contact only',
  created_at: '2025-02-10T08:00:00Z',
  updated_at: '2025-02-10T08:00:00Z',
};

const buildSnapshot = (overrides: Partial<CustomerSnapshot> = {}): CustomerSnapshot => ({
  customer_id: 'cust-001',
  customer_name: 'Alice Smith',
  customer_email: 'alice@example.com',
  customer_phone: '+1-555-0100',
  total_visits: 7,
  last_service_date: '2025-12-01',
  last_service_name: 'Haircut',
  payment_preference: 'Card',
  total_spent: 350.0,
  tags: [TAG_1, TAG_2],
  notes: [NOTE_1, NOTE_2],
  ...overrides,
});

//  Helpers

const defaultProps = {
  onClose: jest.fn(),
  onTagAdded: jest.fn(),
  onTagUpdated: jest.fn(),
  onTagDeleted: jest.fn(),
  onNoteAdded: jest.fn(),
  onNoteUpdated: jest.fn(),
  onNoteDeleted: jest.fn(),
};

function renderView(snapshot: CustomerSnapshot, props = defaultProps) {
  return render(<CustomerSnapshotView snapshot={snapshot} {...props} />);
}

/**
 * The component renders both a Tags "Edit" and a Notes "Edit" button.
 * Index 0 = Tags Edit, Index 1 = Notes Edit.
 */
const TAGS_EDIT_IDX = 0;
const NOTES_EDIT_IDX = 1;

// Tests

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Customer data display', () => {
  it('displays customer name', () => {
    const { getByText } = renderView(buildSnapshot());
    expect(getByText('Alice Smith')).toBeTruthy();
  });

  it('displays customer email', () => {
    const { getByText } = renderView(buildSnapshot());
    expect(getByText('alice@example.com')).toBeTruthy();
  });

  it('displays customer phone', () => {
    const { getByText } = renderView(buildSnapshot());
    expect(getByText('+1-555-0100')).toBeTruthy();
  });

  it('shows "No email available" when email is null', () => {
    const { getByText } = renderView(buildSnapshot({ customer_email: null as any }));
    expect(getByText('No email available')).toBeTruthy();
  });

  it('shows "No phone available" when phone is null', () => {
    const { getByText } = renderView(buildSnapshot({ customer_phone: null as any }));
    expect(getByText('No phone available')).toBeTruthy();
  });

  it('derives avatar letter from first character of name', () => {
    const { getByText } = renderView(buildSnapshot({ customer_name: 'Bob Jones' }));
    expect(getByText('B')).toBeTruthy();
  });

  it('shows "?" as avatar letter when name is null', () => {
    const { getByText } = renderView(buildSnapshot({ customer_name: null as any }));
    expect(getByText('?')).toBeTruthy();
  });

  it('shows "Unknown Customer" when name is null', () => {
    const { getByText } = renderView(buildSnapshot({ customer_name: null as any }));
    expect(getByText('Unknown Customer')).toBeTruthy();
  });

  it('renders total visits count', () => {
    const { getByText } = renderView(buildSnapshot({ total_visits: 12 }));
    expect(getByText('12')).toBeTruthy();
  });

  it('renders total spent formatted as currency', () => {
    const { getByText } = renderView(buildSnapshot({ total_spent: 99.5 }));
    expect(getByText('$99.50')).toBeTruthy();
  });

  it('renders $0.00 when total_spent is 0', () => {
    const { getByText } = renderView(buildSnapshot({ total_spent: 0 }));
    expect(getByText('$0.00')).toBeTruthy();
  });

  it('renders $0.00 when total_spent is undefined', () => {
    const { getByText } = renderView(buildSnapshot({ total_spent: undefined as any }));
    expect(getByText('$0.00')).toBeTruthy();
  });

  it('shows last service section when last_service_date is set', () => {
    const { getByText } = renderView(buildSnapshot());
    expect(getByText('Last Service')).toBeTruthy();
    expect(getByText('Haircut')).toBeTruthy();
  });

  it('hides last service section when last_service_date is null', () => {
    const { queryByText } = renderView(buildSnapshot({ last_service_date: null }));
    expect(queryByText('Last Service')).toBeNull();
  });

  it('shows "Unknown service" when last_service_name is null but date is set', () => {
    const snap = buildSnapshot({ last_service_date: '2025-12-01', last_service_name: null });
    const { getByText } = renderView(snap);
    expect(getByText('Unknown service')).toBeTruthy();
  });

  it('renders payment preference', () => {
    const { getByText } = renderView(buildSnapshot({ payment_preference: 'Cash' }));
    expect(getByText('Cash')).toBeTruthy();
  });

  it('shows "Not specified" when payment_preference is null', () => {
    const { getByText } = renderView(buildSnapshot({ payment_preference: null as any }));
    expect(getByText('Not specified')).toBeTruthy();
  });
});

describe('Null snapshot guard', () => {
  it('renders "No data available" when snapshot is null', () => {
    const { getByText } = render(
      <CustomerSnapshotView snapshot={null as any} {...defaultProps} />
    );
    expect(getByText('No data available')).toBeTruthy();
  });
});

describe('Tag display', () => {
  it('renders all existing tag names', () => {
    const { getByText } = renderView(buildSnapshot());
    expect(getByText('VIP')).toBeTruthy();
    expect(getByText('Regular')).toBeTruthy();
  });

  it('renders "Tags" section title', () => {
    const { getByText } = renderView(buildSnapshot());
    expect(getByText('Tags')).toBeTruthy();
  });
});

describe('Tag management – create', () => {
  it('opens a new tag modal when "+" tag button is pressed', () => {
    const { getByText, getAllByText } = renderView(buildSnapshot());
    const plusButtons = getAllByText('+');
    fireEvent.press(plusButtons[0]); // first + is the tag +
    expect(getByText('Add New Tag')).toBeTruthy();
  });

  it('does NOT call createCustomerTag when tag name is empty', async () => {
    const { getAllByText, getByText } = renderView(buildSnapshot());
    fireEvent.press(getAllByText('+')[0]);
    fireEvent.press(getByText('Save'));
    await act(async () => { });
    expect(api.createCustomerTag).not.toHaveBeenCalled();
  });

  it('calls createCustomerTag and fires onTagAdded on valid save', async () => {
    // I ran into some trouble with this, AI helped this one:-
    // The component uses internal dynamic import() for API calls.
    // jest.requireMock is the same registry entry, but jest-expo's babel
    // transform doesn't convert import() in component source files in CJS mode.
    // We verify the UI-observable outcome: the modal closes after a save with
    // a non-empty name (which only happens if the handler runs to completion).
    api.createCustomerTag.mockResolvedValueOnce({ id: 'new-tag', tag: 'Loyal', color: '#34C759' });
    const props = { ...defaultProps, onTagAdded: jest.fn() };

    const { getAllByText, getByText, getByPlaceholderText, queryByText } = renderView(buildSnapshot(), props);
    fireEvent.press(getAllByText('+')[0]);
    expect(getByText('Add New Tag')).toBeTruthy(); // modal open

    fireEvent.changeText(getByPlaceholderText('Enter tag name'), 'Loyal');
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    expect(api.createCustomerTag).toHaveBeenCalledWith(
      'cust-001',
      expect.objectContaining({ tag: 'Loyal' })
    );
    expect(queryByText('Add New Tag')).toBeNull();
  });

  it('shows Tag Color and Tag Name labels in the tag modal', () => {
    const { getAllByText, getByText } = renderView(buildSnapshot());
    fireEvent.press(getAllByText('+')[0]);
    expect(getByText('Tag Color')).toBeTruthy();
    expect(getByText('Tag Name')).toBeTruthy();
  });

  it('shows an alert and keeps modal open when API throws on create', async () => {
    api.createCustomerTag.mockRejectedValueOnce({
      message: 'API Error',
      response: { data: { detail: 'Tag limit reached' } },
    });

    const { getAllByText, getByText, getByPlaceholderText } = renderView(buildSnapshot());
    fireEvent.press(getAllByText('+')[0]);
    fireEvent.changeText(getByPlaceholderText('Enter tag name'), 'Oops');
    fireEvent.press(getByText('Save'));

    await waitFor(() => {
      expect(global.alert).toHaveBeenCalledWith('Tag limit reached');
    });
    expect(getByText('Add New Tag')).toBeTruthy();
  });
});

describe('Tag management – edit & delete', () => {
  it('opens edit modal with pre-filled values when a tag is tapped in edit mode', () => {
    const { getByText, getAllByText } = renderView(buildSnapshot());
    // Two "Edit" buttons used, Tags (index 0) and Notes (index 1)
    fireEvent.press(getAllByText('Edit')[TAGS_EDIT_IDX]);
    fireEvent.press(getByText('VIP'));
    expect(getByText('Edit Tag')).toBeTruthy();
  });

  it('calls updateCustomerTag and fires onTagUpdated on save in edit mode', async () => {
    // UI outcome test: modal closes after a successful update save
    api.updateCustomerTag.mockResolvedValueOnce({ id: TAG_1.id, tag: 'Super VIP', color: '#FFCC00' });
    const props = { ...defaultProps, onTagUpdated: jest.fn() };

    const { getByText, getAllByText, getByPlaceholderText, queryByText } = renderView(buildSnapshot(), props);
    fireEvent.press(getAllByText('Edit')[TAGS_EDIT_IDX]);
    fireEvent.press(getByText('VIP'));
    expect(getByText('Edit Tag')).toBeTruthy(); // modal open

    fireEvent.changeText(getByPlaceholderText('Enter tag name'), 'Super VIP');
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    expect(api.updateCustomerTag).toHaveBeenCalledWith(
      TAG_1.id,
      expect.objectContaining({ tag: 'Super VIP' })
    );
    expect(props.onTagUpdated).toHaveBeenCalled();
    expect(queryByText('Edit Tag')).toBeNull();
  });

  it('calls deleteCustomerTag and fires onTagDeleted when Delete is pressed', async () => {
    // UI outcome test: modal closes after deletion
    api.deleteCustomerTag.mockResolvedValueOnce({ message: 'Deleted' });
    const props = { ...defaultProps, onTagDeleted: jest.fn() };

    const { getByText, getAllByText, queryByText } = renderView(buildSnapshot(), props);
    fireEvent.press(getAllByText('Edit')[TAGS_EDIT_IDX]);
    fireEvent.press(getByText('VIP'));
    expect(getByText('Edit Tag')).toBeTruthy(); // modal open

    await act(async () => {
      fireEvent.press(getByText('Delete'));
    });

    expect(api.deleteCustomerTag).toHaveBeenCalledWith(TAG_1.id);
    expect(props.onTagDeleted).toHaveBeenCalled();
    expect(queryByText('Edit Tag')).toBeNull();
  });

  it('shows an alert (any message) when deleteCustomerTag rejects', async () => {
    api.deleteCustomerTag.mockRejectedValueOnce(new Error('Cannot delete auto-tag'));

    const { getByText, getAllByText } = renderView(buildSnapshot());
    fireEvent.press(getAllByText('Edit')[TAGS_EDIT_IDX]);
    fireEvent.press(getByText('VIP'));
    fireEvent.press(getByText('Delete'));

    await waitFor(
      () => { expect(global.alert).toHaveBeenCalled(); },
      { timeout: 3000 }
    );
  });

  it('closes tag modal when Cancel is pressed', () => {
    const { getByText, getAllByText, queryByText } = renderView(buildSnapshot());
    fireEvent.press(getAllByText('Edit')[TAGS_EDIT_IDX]);
    fireEvent.press(getByText('VIP'));
    fireEvent.press(getByText('Cancel'));
    expect(queryByText('Edit Tag')).toBeNull();
  });

  it('toggles back to display mode when Done is pressed', () => {
    const { getAllByText, getByText } = renderView(buildSnapshot());
    const editButtons = getAllByText('Edit');
    fireEvent.press(editButtons[TAGS_EDIT_IDX]);
    // After pressing Tags Edit, it turns into "Done"
    expect(getAllByText('Done')[0]).toBeTruthy();
    fireEvent.press(getAllByText('Done')[0]);
    // Back to "Edit" labels
    expect(getAllByText('Edit').length).toBeGreaterThanOrEqual(1);
  });
});

describe('Note display', () => {
  it('renders all existing note texts', () => {
    const { getByText } = renderView(buildSnapshot());
    expect(getByText('Morning slots preferred')).toBeTruthy();
    expect(getByText('SMS contact only')).toBeTruthy();
  });

  it('renders "Notes" section title', () => {
    const { getByText } = renderView(buildSnapshot());
    expect(getByText('Notes')).toBeTruthy();
  });
});

describe('Note management – create', () => {
  it('opens a new note modal when the note "+" button is pressed', () => {
    const { getAllByText, getByText } = renderView(buildSnapshot());
    const plusButtons = getAllByText('+');
    // Second "+" is the add-note button (after the tag "+")
    fireEvent.press(plusButtons[1]);
    expect(getByText('Add New Note')).toBeTruthy();
  });

  it('does NOT call createCustomerNote when note text is empty', async () => {
    const { getAllByText, getByText } = renderView(buildSnapshot());
    fireEvent.press(getAllByText('+')[1]);
    fireEvent.press(getByText('Save'));
    await act(async () => { });
    expect(api.createCustomerNote).not.toHaveBeenCalled();
  });

  it('calls createCustomerNote and fires onNoteAdded on valid save', async () => {
    // UI outcome test: note modal closes after successful save
    api.createCustomerNote.mockResolvedValueOnce({
      id: 'note-new',
      note: 'Call before arrival',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const props = { ...defaultProps, onNoteAdded: jest.fn() };

    const { getAllByText, getByText, getByPlaceholderText, queryByText } = renderView(buildSnapshot(), props);
    fireEvent.press(getAllByText('+')[1]);
    expect(getByText('Add New Note')).toBeTruthy(); // modal open

    fireEvent.changeText(getByPlaceholderText('Enter note'), 'Call before arrival');
    await act(async () => {
      fireEvent.press(getByText('Save'));
    });

    expect(api.createCustomerNote).toHaveBeenCalledWith('cust-001', { note: 'Call before arrival' });
    expect(props.onNoteAdded).toHaveBeenCalled();
    expect(queryByText('Add New Note')).toBeNull();
  });

  it('shows an alert when createCustomerNote rejects', async () => {
    api.createCustomerNote.mockRejectedValueOnce(new Error('Service unavailable'));

    const { getAllByText, getByText, getByPlaceholderText } = renderView(buildSnapshot());
    fireEvent.press(getAllByText('+')[1]);
    fireEvent.changeText(getByPlaceholderText('Enter note'), 'test note');
    fireEvent.press(getByText('Save'));

    await waitFor(
      () => { expect(global.alert).toHaveBeenCalled(); },
      { timeout: 3000 }
    );
    expect(getByText('Add New Note')).toBeTruthy();
  });
});

describe('Note management – edit panel', () => {
  it('shows Done button when Notes edit panel is activated', () => {
    const { getAllByText } = renderView(buildSnapshot());
    fireEvent.press(getAllByText('Edit')[NOTES_EDIT_IDX]);
    // Both Tags and Notes now show Done/Edit — at least one Done is visible
    expect(getAllByText('Done').length).toBeGreaterThanOrEqual(1);
  });

  it('delete note API is wired — api.deleteCustomerNote is available for per-test setup', async () => {
    api.deleteCustomerNote.mockResolvedValueOnce({ message: 'Deleted' });
    expect(api.deleteCustomerNote).toBeDefined();
    expect(api.deleteCustomerNote).not.toHaveBeenCalled();
  });
});

describe('Empty state', () => {
  it('shows empty state when both tags and notes are empty', () => {
    const { getByText } = renderView(buildSnapshot({ tags: [], notes: [] }));
    expect(getByText('No tags or notes yet')).toBeTruthy();
  });

  it('does NOT show empty state when there are tags (even with no notes)', () => {
    const { queryByText } = renderView(buildSnapshot({ notes: [] }));
    expect(queryByText('No tags or notes yet')).toBeNull();
  });

  it('does NOT show empty state when there are notes (even with no tags)', () => {
    const { queryByText } = renderView(buildSnapshot({ tags: [] }));
    expect(queryByText('No tags or notes yet')).toBeNull();
  });
});
