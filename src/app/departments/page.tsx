"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

interface Department {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export default function DepartmentsPage() {
  const { data: session } = useSession();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newDeptName, setNewDeptName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    if (session) {
      fetchDepartments();
    }
  }, [session]);

  const fetchDepartments = async () => {
    try {
      const response = await fetch("/api/departments");
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      }
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;

    setIsAdding(true);
    try {
      const response = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDeptName.trim(),
          sort_order: departments.length,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments([...departments, data.department]);
        setNewDeptName("");
      }
    } catch (error) {
      console.error("Failed to add department:", error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (dept: Department) => {
    setEditingId(dept.id);
    setEditingName(dept.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) {
      handleCancelEdit();
      return;
    }

    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setDepartments((prev) =>
          prev.map((d) => (d.id === id ? data.department : d))
        );
      }
    } catch (error) {
      console.error("Failed to update department:", error);
    } finally {
      handleCancelEdit();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? Any ingredients assigned to this department will have their department cleared.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/departments/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setDepartments((prev) => prev.filter((d) => d.id !== id));
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete department");
      }
    } catch (error) {
      console.error("Failed to delete department:", error);
      alert("Failed to delete department");
    }
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view departments.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
        <span className="text-sm text-gray-500">{departments.length} depts</span>
      </div>

      {/* Add Department */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newDeptName}
            onChange={(e) => setNewDeptName(e.target.value)}
            placeholder="Add a new department..."
            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
            onKeyDown={(e) => e.key === "Enter" && handleAddDepartment()}
          />
          <button
            onClick={handleAddDepartment}
            disabled={isAdding || !newDeptName.trim()}
            className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 font-medium whitespace-nowrap"
          >
            {isAdding ? "Adding..." : "Add Department"}
          </button>
        </div>
      </div>

      {/* Department List */}
      {departments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 text-center text-gray-500">
          No departments yet. Add your first department above.
        </div>
      ) : (
        <>
          {/* Mobile card view */}
          <div className="md:hidden space-y-3">
            {departments.map((dept, index) => (
              <div key={dept.id} className="bg-white rounded-xl shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400 w-6">{index + 1}.</span>
                      {editingId === dept.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(dept.id);
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          onBlur={() => handleSaveEdit(dept.id)}
                          autoFocus
                          className="flex-1 px-2 py-1 border border-emerald-500 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-base"
                        />
                      ) : (
                        <button
                          onClick={() => handleStartEdit(dept)}
                          className="text-emerald-600 font-medium text-left truncate"
                        >
                          {dept.name}
                        </button>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1 ml-8">
                      Added {new Date(dept.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(dept.id, dept.name)}
                    className="px-3 py-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table view */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-16">
                    Order
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-32">
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {departments.map((dept, index) => (
                  <tr key={dept.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-500">{index + 1}</td>
                    <td className="px-4 py-3">
                      {editingId === dept.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(dept.id);
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          onBlur={() => handleSaveEdit(dept.id)}
                          autoFocus
                          className="w-full px-2 py-1 border border-emerald-500 rounded focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      ) : (
                        <button
                          onClick={() => handleStartEdit(dept)}
                          className="text-emerald-600 hover:text-emerald-700 font-medium text-left hover:underline"
                        >
                          {dept.name}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(dept.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(dept.id, dept.name)}
                        className="text-red-500 hover:text-red-700 text-sm"
                        title="Delete department"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
