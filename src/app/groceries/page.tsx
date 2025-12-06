"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

interface GroceryItem {
  id: string;
  name: string;
  category: string;
  checked: boolean;
}

const CATEGORIES = [
  "Produce",
  "Dairy",
  "Meat & Seafood",
  "Bakery",
  "Pantry",
  "Frozen",
  "Beverages",
  "Other",
];

export default function GroceriesPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<GroceryItem[]>([
    { id: "1", name: "Milk", category: "Dairy", checked: false },
    { id: "2", name: "Eggs", category: "Dairy", checked: false },
    { id: "3", name: "Bread", category: "Bakery", checked: true },
    { id: "4", name: "Chicken breast", category: "Meat & Seafood", checked: false },
    { id: "5", name: "Broccoli", category: "Produce", checked: false },
    { id: "6", name: "Onions", category: "Produce", checked: false },
  ]);
  const [newItem, setNewItem] = useState("");
  const [newCategory, setNewCategory] = useState("Other");

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    setItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: newItem.trim(),
        category: newCategory,
        checked: false,
      },
    ]);
    setNewItem("");
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearChecked = () => {
    setItems((prev) => prev.filter((item) => !item.checked));
  };

  const groupedItems = items.reduce(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, GroceryItem[]>
  );

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Please sign in to view your grocery list.</p>
      </div>
    );
  }

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grocery List</h1>
          <p className="text-gray-500 text-sm">
            {items.length - checkedCount} items remaining
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={clearChecked}
            className="text-gray-500 hover:text-gray-700 text-sm"
            disabled={checkedCount === 0}
          >
            Clear checked
          </button>
          <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors text-sm">
            Save to Drive
          </button>
        </div>
      </div>

      {/* Add new item */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex space-x-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Add an item..."
            className="flex-1 border rounded-lg px-4 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="border rounded-lg px-3 py-2 text-gray-600 focus:ring-2 focus:ring-emerald-500"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <button
            onClick={addItem}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
          >
            Add
          </button>
        </div>
      </div>

      {/* Grouped items */}
      <div className="space-y-4">
        {CATEGORIES.filter((cat) => groupedItems[cat]?.length > 0).map(
          (category) => (
            <div key={category} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b">
                <h2 className="font-medium text-gray-700">{category}</h2>
              </div>
              <ul className="divide-y">
                {groupedItems[category].map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center px-4 py-3 hover:bg-gray-50 group"
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleItem(item.id)}
                      className="h-5 w-5 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                    />
                    <span
                      className={`ml-3 flex-1 ${
                        item.checked ? "text-gray-400 line-through" : "text-gray-700"
                      }`}
                    >
                      {item.name}
                    </span>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        )}
      </div>

      {items.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>Your grocery list is empty!</p>
          <p className="text-sm mt-1">Add items above or generate from your meal plan.</p>
        </div>
      )}
    </div>
  );
}
