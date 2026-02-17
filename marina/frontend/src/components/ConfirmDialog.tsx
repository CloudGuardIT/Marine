import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleClose = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {state && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={() => handleClose(false)}>
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2 rounded-lg shrink-0 ${
                state.variant === 'danger' ? 'bg-red-100' :
                state.variant === 'warning' ? 'bg-yellow-100' : 'bg-blue-100'
              }`}>
                {state.variant === 'danger' ? (
                  <Trash2 size={20} className="text-red-600" />
                ) : (
                  <AlertTriangle size={20} className={state.variant === 'warning' ? 'text-yellow-600' : 'text-blue-600'} />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-800">{state.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{state.message}</p>
              </div>
              <button
                onClick={() => handleClose(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm font-medium transition"
              >
                {state.cancelLabel || 'ביטול'}
              </button>
              <button
                onClick={() => handleClose(true)}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition ${
                  state.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700'
                    : state.variant === 'warning'
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {state.confirmLabel || 'אישור'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextType['confirm'] {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}
