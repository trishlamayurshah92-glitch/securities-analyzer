import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAnalysis } from '../useAnalysis';

const mockRunAnalysis = vi.fn();

vi.mock('../../api/client', () => ({
  api: {
    runAnalysis: (...args: unknown[]) => mockRunAnalysis(...args),
  },
}));

const mockResult = {
  report: '# Report',
  stocks_analyzed: ['AAPL'],
  model: 'gemini-2.5-flash',
  duration_seconds: 15,
};

describe('useAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('run() calls runAnalysis with provided symbols', async () => {
    mockRunAnalysis.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useAnalysis());
    await act(() => result.current.run(['AAPL']));

    expect(mockRunAnalysis).toHaveBeenCalledWith(['AAPL']);
  });

  it('run() without args calls runAnalysis with undefined', async () => {
    mockRunAnalysis.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useAnalysis());
    await act(() => result.current.run());

    expect(mockRunAnalysis).toHaveBeenCalledWith(undefined);
  });

  it('loading=true during run, false after', async () => {
    let resolve: (v: typeof mockResult) => void;
    mockRunAnalysis.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { result } = renderHook(() => useAnalysis());

    act(() => { result.current.run(['AAPL']); });
    expect(result.current.loading).toBe(true);

    act(() => resolve!(mockResult));
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('data set to result on success', async () => {
    mockRunAnalysis.mockResolvedValue(mockResult);

    const { result } = renderHook(() => useAnalysis());
    await act(() => result.current.run(['AAPL']));

    expect(result.current.data?.report).toBe('# Report');
  });

  it('error set when runAnalysis throws', async () => {
    mockRunAnalysis.mockRejectedValue(new Error('API error'));

    const { result } = renderHook(() => useAnalysis());
    await act(() => result.current.run(['AAPL']));

    expect(result.current.error).toBe('API error');
  });

  it('calling run() again clears previous data and error', async () => {
    mockRunAnalysis
      .mockRejectedValueOnce(new Error('first error'))
      .mockResolvedValueOnce(mockResult);

    const { result } = renderHook(() => useAnalysis());

    await act(() => result.current.run(['AAPL']));
    expect(result.current.error).toBe('first error');

    await act(() => result.current.run(['AAPL']));
    expect(result.current.error).toBeNull();
    expect(result.current.data?.report).toBe('# Report');
  });
});
