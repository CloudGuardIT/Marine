import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Server } from 'lucide-react';
import { api } from '../api';
import type { User, WorkerStatus } from '../types';

export default function Settings() {
  const [users, setUsers] = useState<User[]>([]);
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);

  useEffect(() => {
    api.getUsers().then(setUsers).catch(() => {});
    api.getHealth().then((h) => setWorkers(h.workers)).catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 mb-6">
        <SettingsIcon size={24} /> הגדרות
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-800">משתמשים</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2 text-right font-medium">שם</th>
                <th className="px-4 py-2 text-right font-medium">טלפון</th>
                <th className="px-4 py-2 text-right font-medium">תפקיד</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">{u.name}</td>
                  <td className="px-4 py-2.5 text-gray-500" dir="ltr">{u.phone}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.role === 'admin' ? 'bg-red-100 text-red-800' :
                      u.role === 'operator' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {u.role === 'admin' ? 'מנהל' : u.role === 'operator' ? 'מפעיל' : 'לקוח'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Workers */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-800 flex items-center gap-2">
            <Server size={16} /> עובדי רקע (Workers)
          </div>
          <div className="divide-y divide-gray-50">
            {workers.map((w) => (
              <div key={w.name} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${w.running ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-medium text-sm">{w.name}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${w.running ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {w.running ? 'פעיל' : 'מושבת'}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-gray-400 mt-1">
                  <span>הרצות: {w.runCount}</span>
                  <span>שגיאות: {w.errorCount}</span>
                  {w.lastRun && <span>ריצה אחרונה: {new Date(w.lastRun).toLocaleTimeString('he-IL')}</span>}
                </div>
                {w.lastError && <div className="text-xs text-red-500 mt-1">{w.lastError}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
