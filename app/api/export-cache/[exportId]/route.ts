import { NextRequest, NextResponse } from 'next/server';
import { readExportEntry } from '@/app/lib/exportCache';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ exportId: string }> }) {
  const { exportId } = await params;
  const entry = readExportEntry(exportId);

  if (!entry) {
    return NextResponse.json({ error: 'Export introuvable ou expiré' }, { status: 404 });
  }

  return NextResponse.json(entry);
}