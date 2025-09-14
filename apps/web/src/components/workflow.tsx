import { PhoneCall } from "@/components/phone-call";
import { CalculatorIcon, Linkedin, Phone, Mail, FileText } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

type StepStatus = "Completed" | "Running" | "Idle";
type StepVariant = "trigger" | "ai" | "filter" | "default";

const statusClasses: Record<StepStatus, string> = {
  Completed: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Running: "bg-gray-50 text-gray-700 border border-gray-200",
  Idle: "bg-gray-50 text-gray-500 border border-gray-200",
};

const variantBorder: Record<StepVariant, string> = {
  trigger: "border-emerald-300",
  ai: "border-sky-300",
  filter: "border-rose-300",
  default: "border-gray-200",
};

const badgeBase =
  "text-xs px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-700";

export const Workflow = () => {
  type NodeId =
    | "company"
    | "research"
    | "email"
    | "draft"
    | "linkedin"
    | "phone"
    | "call-controls"
    | "email-breakup";

  const sequence: NodeId[] = [
    "company",
    "research",
    "email",
    "draft",
    "linkedin",
    "phone",
    "call-controls",
    "email-breakup",
  ];

  const [currentNode, setCurrentNode] = useState<NodeId>(sequence[0]);
  const nodeIndex: Record<NodeId, number> = Object.fromEntries(
    sequence.map((id, i) => [id, i])
  ) as Record<NodeId, number>;

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      index = (index + 1) % sequence.length;
      setCurrentNode(sequence[index]);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  const NodeCard = ({
    id,
    title,
    badge,
    description,
    variant = "default",
    children,
    icon,
    iconBgClass,
    active = false,
  }: {
    id: NodeId;
    title: string;
    badge?: string;
    description?: string;
    variant?: StepVariant;
    children?: ReactNode;
    icon?: ReactNode;
    iconBgClass?: string;
    active?: boolean;
  }) => {
    const isFuture = nodeIndex[id] > nodeIndex[currentNode];
    const bgClass = active
      ? "bg-emerald-500/10"
      : isFuture
        ? "bg-slate-100"
        : "bg-white";
    return (
      <div
        className={`relative w-[520px] rounded-2xl shadow-sm px-5 py-4 border ${
          active
            ? "bg-emerald-500/10 ring-2 ring-green-500/10 border-emerald-400"
            : bgClass + " " + variantBorder[variant]
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {icon ? (
              <span
                className={`inline-flex items-center justify-center h-8 w-8 rounded-md ${
                  iconBgClass ?? "bg-gray-100"
                }`}
              >
                <span className="text-gray-700">{icon}</span>
              </span>
            ) : null}
            <div className="text-[15px] font-medium text-gray-900">{title}</div>
          </div>
          {badge ? <span className={badgeBase}>{badge}</span> : null}
        </div>
        {description ? (
          <div className="text-sm text-gray-500 mt-2">{description}</div>
        ) : null}
        {/* marching ants overlay for active state */}
        {active ? (
          <svg
            className="pointer-events-none absolute left-0 top-0 h-full w-full rounded-2xl"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <rect
              x="1"
              y="1"
              width="98"
              height="98"
              rx="12"
              ry="12"
              fill="none"
              stroke="rgb(16,185,129)"
              className="ants-dash"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        ) : null}
        {children}
      </div>
    );
  };

  return (
    <div className="flex gap-10">
      {/* Individual workflow group */}
      <div className="flex flex-col items-center py-6">
        {/* Workflow group */}
        <div className="flex flex-col items-center border rounded-xl p-6 bg-yellow-500/10">
          {/* Wofklow header */}
          <div className="flex items-center justify-between gap-2 self-stretch mb-6 ">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 p-4 rounded-xl bg-white">
                <CalculatorIcon />
              </div>
              <div className="flex items-center gap-2">Call Agent</div>
            </div>

            <div className="flex items-center gap-2 rounded-full py-2 px-4 border border-yellow-500/20 bg-yellow-50">
              Intent: 500
            </div>
          </div>

          {/* Company */}
          <div className="relative flex flex-col items-center">
            <NodeCard
              id="company"
              title="Company"
              badge="Company"
              variant="trigger"
              active={currentNode === "company"}
            >
              <div className="mt-3 flex items-center gap-3">
                <img
                  src="https://logo.clearbit.com/meta.com"
                  alt="Meta"
                  className="h-6 w-7.5 rounded"
                />
                <div className="text-sm text-gray-700">Meta</div>
              </div>
            </NodeCard>
            <div className="flex flex-col items-center -mt-2">
              <span className="z-10 h-3 w-3 rounded-full bg-white border border-gray-300"></span>
              <span className="block w-px h-12 bg-gray-300"></span>
            </div>
          </div>

          {/* Research */}
          <div className="relative flex flex-col items-center">
            <NodeCard
              id="research"
              title="Research"
              badge="AI"
              variant="ai"
              description="Look into the company for context"
              active={currentNode === "research"}
            />
            {/* Branch down from research */}
            <div className="flex flex-col items-center -mt-2">
              <span className="z-10 h-3 w-3 rounded-full bg-white border border-gray-300"></span>
              <span className="block w-px h-6 bg-gray-300"></span>
            </div>
          </div>

          {/* Branches: Email (+ Draft) and LinkedIn InMail */}
          <div className="relative flex items-start gap-8 mt-2">
            {/* Horizontal branch line from center */}
            <div className="absolute left-0 right-0 -top-4 h-px bg-gray-300"></div>
            <span className="absolute left-1/2 -translate-x-1/2 -top-6 h-3 w-3 rounded-full bg-white border border-gray-300"></span>
            {/* Edge label to LinkedIn branch */}
            <div
              className={`absolute -top-8 right-0 text-xs px-2 py-0.5 rounded-full ${statusClasses.Running}`}
            >
              if email not responded within 10 mins
            </div>

            {/* Left column - Email + Draft */}
            <div className="flex flex-col items-center">
              <div className="flex flex-col items-center">
                <div className="-mt-2 mb-2 w-px h-4 bg-gray-300"></div>
                <NodeCard
                  id="email"
                  title="Email"
                  badge="Channel"
                  variant="default"
                  icon={<Mail size={14} />}
                  iconBgClass="bg-sky-100 border border-sky-200"
                  active={currentNode === "email"}
                />
              </div>
              {/* connector to Draft */}
              <div className="flex flex-col items-center mt-1">
                <span className="z-10 h-3 w-3 rounded-full bg-white border border-gray-300"></span>
                <span className="block w-px h-6 bg-gray-300"></span>
              </div>
              <NodeCard
                id="draft"
                title="Draft"
                badge="Editor"
                variant="default"
                icon={<FileText size={14} />}
                iconBgClass="bg-gray-1000 border border-gray-200"
                active={currentNode === "draft"}
              >
                <textarea
                  className="mt-3 w-full h-24 rounded-md border border-gray-200 p-2 text-sm outline-none focus:ring-2 focus:ring-sky-200"
                  placeholder="Draft your email..."
                />
              </NodeCard>
            </div>

            {/* Right column - LinkedIn InMail */}
            <div className="flex flex-col items-center">
              <div className="-mt-2 mb-2 w-px h-4 bg-gray-300"></div>
              <NodeCard
                id="linkedin"
                title="LinkedIn InMail"
                badge="Channel"
                variant="default"
                icon={<Linkedin size={16} />}
                iconBgClass="bg-blue-100 border border-blue-200"
                active={currentNode === "linkedin"}
              />
            </div>

            {/* bottom join line across both columns */}
            <div className="absolute left-0 right-0 -bottom-4 h-px bg-gray-300"></div>
            <span className="absolute left-1/2 -translate-x-1/2 -bottom-6 h-3 w-3 rounded-full bg-white border border-gray-300"></span>
          </div>

          {/* Phone / Voicemail */}
          <div className="flex flex-col items-center mt-8">
            <span className="block w-px h-6 bg-gray-300 -mt-2"></span>
            <NodeCard
              id="phone"
              title="Phone / Voicemail"
              badge="Channel"
              variant="default"
              icon={<Phone size={16} />}
              iconBgClass="bg-emerald-100 border border-emerald-200"
              active={currentNode === "phone"}
            />
          </div>

          {/* Nested group to the right of phone */}
          <div className="mt-6 self-stretch flex items-start justify-center gap-8">
            {/* Spacer to center nesting to the right visually */}
            <div className="w-[520px]"></div>
            <div className="flex flex-col items-center border rounded-xl p-4 bg-gray-50">
              <NodeCard
                id="call-controls"
                title="Call Controls"
                variant="default"
                active={currentNode === "call-controls"}
              >
                <PhoneCall />
              </NodeCard>
            </div>
          </div>

          {/* Email (breakup) */}
          <div className="flex flex-col items-center mt-6">
            <div className="flex flex-col items-center -mt-2">
              <span className="z-10 h-3 w-3 rounded-full bg-white border border-gray-300"></span>
              <span className="block w-px h-6 bg-gray-300"></span>
            </div>
            <NodeCard
              id="email-breakup"
              title="Email (breakup)"
              badge="Channel"
              variant="default"
              icon={<Mail size={14} />}
              iconBgClass="bg-rose-100 border border-rose-200"
              active={currentNode === "email-breakup"}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
