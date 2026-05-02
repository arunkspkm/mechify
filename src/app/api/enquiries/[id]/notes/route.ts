import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const createNoteSchema = z.object({
  message: z.string().min(1, "Message is required").max(2000),
});

// POST /api/enquiries/[id]/notes — Add a communication log entry
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = createNoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const enquiry = await prisma.customerEnquiry.findUnique({ where: { id }, select: { id: true } });
  if (!enquiry) {
    return NextResponse.json({ error: "Enquiry not found" }, { status: 404 });
  }

  const note = await prisma.enquiryNote.create({
    data: {
      enquiry: { connect: { id } },
      user: { connect: { id: session.user.id } },
      message: parsed.data.message.trim(),
    },
    include: { user: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ data: note }, { status: 201 });
}
