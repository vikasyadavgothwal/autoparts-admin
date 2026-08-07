import {
  businessEntitlementActionRules,
  businessEntitlementFeatures,
  businessRequestableFeatureLabels,
} from "@/services/business/business-platform-service"

type RoleFeatureMap = typeof businessEntitlementFeatures
type KnownFeature = RoleFeatureMap[keyof RoleFeatureMap][number]

type ActionRuleMap = typeof businessEntitlementActionRules
type ActionRule = ActionRuleMap[keyof ActionRuleMap][keyof ActionRuleMap[keyof ActionRuleMap]]
type ActionFeature = NonNullable<ActionRule["feature"]>

type MissingActionFeature = Exclude<ActionFeature, KnownFeature>
type UnknownRequestableFeature = Exclude<keyof typeof businessRequestableFeatureLabels, KnownFeature>

const actionFeaturesAreKnown: MissingActionFeature extends never ? true : never = true
const requestableFeaturesAreKnown: UnknownRequestableFeature extends never ? true : never = true

void actionFeaturesAreKnown
void requestableFeaturesAreKnown
