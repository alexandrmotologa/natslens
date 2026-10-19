package natsclient

import "github.com/nats-io/nats.go"

// DeliverPolicyString returns string representation of a DeliverPolicy.
func DeliverPolicyString(p nats.DeliverPolicy) string {
	switch p {
	case nats.DeliverAllPolicy:
		return "all"
	case nats.DeliverLastPolicy:
		return "last"
	case nats.DeliverNewPolicy:
		return "new"
	case nats.DeliverByStartSequencePolicy:
		return "by_start_sequence"
	case nats.DeliverByStartTimePolicy:
		return "by_start_time"
	case nats.DeliverLastPerSubjectPolicy:
		return "last_per_subject"
	default:
		return "all"
	}
}

// AckPolicyString returns string representation of an AckPolicy.
func AckPolicyString(p nats.AckPolicy) string {
	switch p {
	case nats.AckExplicitPolicy:
		return "explicit"
	case nats.AckAllPolicy:
		return "all"
	case nats.AckNonePolicy:
		return "none"
	default:
		return "explicit"
	}
}

// ReplayPolicyString returns string representation of a ReplayPolicy.
func ReplayPolicyString(p nats.ReplayPolicy) string {
	switch p {
	case nats.ReplayOriginalPolicy:
		return "original"
	case nats.ReplayInstantPolicy:
		return "instant"
	default:
		return "instant"
	}
}

// RetentionPolicyString returns string representation of a RetentionPolicy.
func RetentionPolicyString(p nats.RetentionPolicy) string {
	switch p {
	case nats.LimitsPolicy:
		return "limits"
	case nats.InterestPolicy:
		return "interest"
	case nats.WorkQueuePolicy:
		return "workqueue"
	default:
		return "limits"
	}
}

// StorageTypeString returns string representation of StorageType.
func StorageTypeString(s nats.StorageType) string {
	switch s {
	case nats.MemoryStorage:
		return "memory"
	case nats.FileStorage:
		return "file"
	default:
		return "file"
	}
}

// DiscardPolicyString returns string representation of DiscardPolicy.
func DiscardPolicyString(d nats.DiscardPolicy) string {
	switch d {
	case nats.DiscardOld:
		return "old"
	case nats.DiscardNew:
		return "new"
	default:
		return "old"
	}
}
